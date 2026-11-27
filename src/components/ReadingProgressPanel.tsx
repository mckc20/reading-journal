import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReadingProgressMode } from "@/components/ReadingProgressDialog";
import LoadingIndicator from "@/components/LoadingIndicator";
import { ProgressBookSummary, ProgressPageWheel, ProgressWheelField, ProgressWheels } from "@/components/redesign/ProgressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchProgressWindowLogs, saveReadingActivity, type ReadingActivityDraft } from "@/lib/books";
import { useBooksContext } from "@/context/BooksContext";
import { getLocalReadingDay, getLoggedSessionMinutes, getSessionTimes, toDateTimeLocalValue } from "@/lib/readingActivity";
import type { Book, ReadingLog } from "@/types";

interface ReadingProgressPanelProps {
  book: Book;
  mode: ReadingProgressMode;
  titleLink?: ReactNode;
  onProgressSaved: (log: ReadingLog) => Promise<void>;
  onCancel: () => void;
  onSavingChange: (saving: boolean) => void;
}

const clockFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function formatClockMinute(minute: number) {
  return clockFormatter.format(new Date(minute * 60_000));
}

function parseClockDigits(digits: string) {
  const hours = Number(digits.length > 2 ? digits.slice(0, -2) : digits);
  const minutes = digits.length > 2 ? Number(digits.slice(-2)) : 0;
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export default function ReadingProgressPanel({
  book, mode, titleLink, onProgressSaved, onCancel, onSavingChange,
}: ReadingProgressPanelProps) {
  const { refreshBook } = useBooksContext();
  const errorId = useId();
  const dateId = useId();
  const timeId = useId();
  const [openedAt] = useState(() => new Date());
  const initialEnd = openedAt.getHours() * 60 + openedAt.getMinutes();
  const [pendingLog, setPendingLog] = useState<ReadingLog | null>(null);
  const [pendingDraft, setPendingDraft] = useState<ReadingActivityDraft | null>(null);
  const [draftPage, setDraftPage] = useState<number | null>(null);
  const [startMinute, setStartMinute] = useState(Math.max(0, initialEnd - 15));
  const [endMinute, setEndMinute] = useState(initialEnd);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => getLocalReadingDay(openedAt).day);
  const [selectedTime, setSelectedTime] = useState(() => toDateTimeLocalValue(openedAt).slice(11));
  const loggedAt = `${selectedDate}T${selectedTime}`;
  const [windowAttempt, setWindowAttempt] = useState(0);
  const [windowInfo, setWindowInfo] = useState<{ end: Date; minutes: number | null }>();
  const isSession = mode === "session";
  const isChangingDate = mode === "change_date";
  const currentPage = Math.max(0, book.current_page ?? 0);
  const totalPages = Math.max(0, book.total_pages ?? 0);
  const remainingPages = Math.max(0, totalPages - currentPage);
  const minPage = Math.min(currentPage + 1, totalPages);
  const selectedPage = Math.min(totalPages, Math.max(minPage, draftPage ?? minPage));
  const windowEnd = useMemo(
    () => isChangingDate ? new Date(loggedAt) : new Date(),
    [isChangingDate, loggedAt, windowAttempt, currentPage],
  );
  const fieldsDisabled = saving || pendingLog !== null || pendingDraft !== null;
  const needsWindow = !isSession && !pendingLog && !pendingDraft && remainingPages > 0
    && Number.isFinite(windowEnd.getTime());
  const loading = needsWindow && windowInfo?.end !== windowEnd;
  const windowLoadFailed = needsWindow && !loading && windowInfo?.minutes === null;
  const loggedMinutes = !loading ? windowInfo?.minutes ?? 0 : 0;

  useEffect(() => {
    if (!needsWindow) return;
    let cancelled = false;
    const { day, start } = getLocalReadingDay(windowEnd);
    void fetchProgressWindowLogs(book.id, day, start.toISOString(), windowEnd.toISOString())
      .then(logs => {
        if (!cancelled) setWindowInfo({ end: windowEnd, minutes: getLoggedSessionMinutes(logs, start, windowEnd) });
      })
      .catch(() => {
        if (!cancelled) setWindowInfo({ end: windowEnd, minutes: null });
      });
    return () => { cancelled = true; };
  }, [book.id, needsWindow, windowEnd]);

  function makeDraft(): ReadingActivityDraft {
    const base = {
      bookId: book.id,
      id: crypto.randomUUID(),
      startingPage: currentPage,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (isSession) {
      const { start, end } = getSessionTimes(openedAt, startMinute, endMinute);
      return { ...base, kind: "session", currentPage: selectedPage, start: start.toISOString(), loggedAt: end.toISOString() };
    }
    let adjustedTime: string | null = null;
    if (isChangingDate) {
      const value = new Date(loggedAt);
      if (!Number.isFinite(value.getTime()) || toDateTimeLocalValue(value) !== loggedAt || value > new Date()) {
        throw new Error("Choose a valid update date and time at or before now.");
      }
      adjustedTime = value.toISOString();
    }
    return { ...base, kind: "progress_update", currentPage: selectedPage, minutes: hours * 60 + minutes || null, loggedAt: adjustedTime };
  }

  async function handleSave() {
    if (savingRef.current || loading) return;
    setError(null);
    savingRef.current = true;
    setSaving(true);
    onSavingChange(true);
    let readingLog = pendingLog;
    try {
      if (!readingLog) {
        const draft = pendingDraft ?? makeDraft();
        setPendingDraft(draft);
        readingLog = await saveReadingActivity(draft);
        setPendingLog(readingLog);
        setPendingDraft(null);
      }
      await refreshBook(book.id);
      await onProgressSaved(readingLog);
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
      const message = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : null;
      if (!readingLog && (code === "PT409" || code === "22023" || code === "P0002")) setPendingDraft(null);
      if (!readingLog && code === "PT409") {
        try {
          await refreshBook(book.id);
          setDraftPage(null);
          setWindowAttempt(attempt => attempt + 1);
        } catch {
          setError("The book changed. Reopen this form to get its current position.");
          return;
        }
      }
      const fallback = isSession ? "The session could not be saved. Try again." : "Progress could not be saved. Try again.";
      setError(readingLog ? "Reading activity was saved. Retry to finish updating this screen." : message || fallback);
    } finally {
      savingRef.current = false;
      setSaving(false);
      onSavingChange(false);
    }
  }

  return (
    <div className="rj-progress-form">
      <ProgressBookSummary
        titleLink={titleLink}
        book={{
          id: book.id, title: book.title, author: book.authors.join(", "),
          cover: book.cover_url, currentPage, totalPages,
        }}
      />

      {totalPages === 0 && <p className="rj-muted">Set the total pages to track progress.</p>}
      {totalPages > 0 && remainingPages === 0 && !pendingLog && !pendingDraft && (
        <p className="rj-muted">You’ve reached the last page of this book.</p>
      )}
      {remainingPages > 0 && isSession && (
        <>
          <p className="rj-muted text-sm">Choose times from today. Include reading you haven’t already logged.</p>
          <ProgressPageWheel min={minPage} max={totalPages} value={selectedPage}
            onChange={setDraftPage} disabled={fieldsDisabled} describedBy={error ? errorId : undefined} />
          <div className="grid grid-cols-2 gap-3">
            <ProgressWheelField label="Start time" value={startMinute} min={0} max={1439} pageJump={60}
              formatValue={formatClockMinute} parseTypedValue={parseClockDigits} onChange={setStartMinute}
              disabled={fieldsDisabled} describedBy={error ? errorId : undefined} />
            <ProgressWheelField label="End time" value={endMinute} min={0} max={1439} pageJump={60}
              formatValue={formatClockMinute} parseTypedValue={parseClockDigits} onChange={setEndMinute}
              disabled={fieldsDisabled} describedBy={error ? errorId : undefined} />
          </div>
        </>
      )}
      {remainingPages > 0 && !isSession && (
        <>
          {isChangingDate && (
            <fieldset className="space-y-2">
              <legend className="rj-picker-label">Date and time</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={dateId} className="text-xs">Date</Label>
                  <Input id={dateId} type="date" value={selectedDate} max={getLocalReadingDay(new Date()).day}
                    disabled={fieldsDisabled} aria-describedby={error ? errorId : undefined}
                    onChange={event => setSelectedDate(event.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={timeId} className="text-xs">Time</Label>
                  <Input id={timeId} type="time" value={selectedTime} disabled={fieldsDisabled}
                    aria-describedby={error ? errorId : undefined} onChange={event => setSelectedTime(event.target.value)} />
                </div>
              </div>
            </fieldset>
          )}
          {loading && <LoadingIndicator variant="inline" label="Checking for logged sessions…" />}
          {windowLoadFailed && (
            <div className="flex flex-wrap items-center gap-2" role="status">
              <p>Couldn’t check for sessions in this window.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setWindowAttempt(attempt => attempt + 1)}>Try again</Button>
            </div>
          )}
          {loggedMinutes > 0 && (
            <p className="rj-muted text-sm" role="status">
              {loggedMinutes < 1 ? "Less than 1 minute is" : `${Number.isInteger(loggedMinutes) ? "" : "About "}${Math.round(loggedMinutes)} ${Math.round(loggedMinutes) === 1 ? "minute is" : "minutes are"}`} already logged in this window.
            </p>
          )}
          <ProgressWheels
            page={selectedPage}
            minPage={minPage}
            maxPage={totalPages}
            hours={hours}
            maxHours={6}
            additionalTime={loggedMinutes > 0}
            minutes={minutes}
            disabled={fieldsDisabled}
            errorId={error ? errorId : undefined}
            onPageChange={setDraftPage}
            onHoursChange={setHours}
            onMinutesChange={setMinutes}
          />
        </>
      )}
      {error && <p role="alert" id={errorId}>{error}</p>}
      <div className="rj-progress-footer">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        {(remainingPages > 0 || pendingLog || pendingDraft) && (
          <Button type="button" disabled={loading || windowLoadFailed || saving} onClick={() => void handleSave()}>
            {saving ? "Saving…" : pendingLog || pendingDraft ? "Retry" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
