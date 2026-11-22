import { lazy, Suspense, useEffect, useId, useState } from "react";
import LoadingIndicator from "@/components/LoadingIndicator";
import { ProgressBookSummary, ProgressWheels } from "@/components/redesign/ProgressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProgressNoteDate, updateBookJournalEntryRecord } from "@/lib/bookJournal";
import { createReadingLog, fetchLastReadingLog } from "@/lib/books";
import { useAuth } from "@/context/AuthContext";
import { READING_LOG_NOTE_TAG_PREFIX, normalizeJournalTags } from "@/lib/journalTags";
import type { Book, BookJournalEntryRecord, ReadingLog } from "@/types";

const JournalEntryForm = lazy(() => import("@/components/AddJournalEntryDialog").then(module => ({ default: module.JournalEntryForm })));

interface ReadingProgressPanelProps {
  book: Book;
  onProgressSaved: (newCurrentPage: number) => Promise<void>;
  onCancel: () => void;
  onEntryComposerOpenChange: (open: boolean) => void;
  onSavingChange: (saving: boolean) => void;
}

function toDateTimeLocalValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

async function attachNoteToReadingLog(note: BookJournalEntryRecord, readingLog: ReadingLog): Promise<BookJournalEntryRecord> {
  const readingLogTag = `${READING_LOG_NOTE_TAG_PREFIX}${readingLog.id}`;
  const tags = normalizeJournalTags([...(note.tags ?? []), readingLogTag]);

  return updateBookJournalEntryRecord({
    noteId: note.id,
    label: note.label,
    attribution: note.attribution ?? undefined,
    content: note.content,
    tags,
    pageStart: note.page_start ?? undefined,
    noteDate: note.entry_date,
    isFavorite: note.is_favorite,
  });
}

export default function ReadingProgressPanel({
  book, onProgressSaved, onCancel, onEntryComposerOpenChange, onSavingChange,
}: ReadingProgressPanelProps) {
  const { user } = useAuth();
  const errorId = useId();
  const optionsId = useId();
  const dateId = useId();
  const [lastLog, setLastLog] = useState<ReadingLog | null>();
  const [pendingLog, setPendingLog] = useState<ReadingLog | null>(null);
  const [draftPage, setDraftPage] = useState<number | null>(null);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showLoggedAtEditor, setShowLoggedAtEditor] = useState(false);
  const [loggedAt, setLoggedAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [savedProgressNote, setSavedProgressNote] = useState<BookJournalEntryRecord | null>(null);
  const currentPage = Math.max(0, book.current_page ?? 0);
  const totalPages = Math.max(0, book.total_pages ?? 0);
  const minPage = Math.min(Math.max(currentPage, lastLog?.current_page ?? 0) + 1, totalPages);
  const selectedPage = draftPage ?? minPage;
  const loading = totalPages > 0 && lastLog === undefined;
  const fieldsDisabled = saving || pendingLog !== null;

  useEffect(() => {
    if (totalPages === 0) return;
    let cancelled = false;
    void fetchLastReadingLog(book.id)
      .then(log => { if (!cancelled) setLastLog(log); })
      .catch(() => { if (!cancelled) setLastLog(null); });
    return () => { cancelled = true; };
  }, [book.id, totalPages]);

  function toggleNoteEditor(open: boolean) {
    setShowNoteEditor(open);
    onEntryComposerOpenChange(open);
  }

  async function handleSave() {
    if (!user || saving || loading) return;
    setSaving(true);
    onSavingChange(true);
    setError(null);
    try {
      let readingLog = pendingLog;
      if (!readingLog) {
        const timestamp = showLoggedAtEditor && loggedAt ? new Date(loggedAt) : undefined;
        if (timestamp && Number.isNaN(timestamp.getTime())) throw new Error("Invalid date/time for progress entry");
        readingLog = await createReadingLog(
          book.id, user.id, selectedPage, hours * 60 + minutes || undefined, timestamp?.toISOString(),
        );
        // If a later step fails, retry it with the log already written.
        setPendingLog(readingLog);
      }
      if (savedProgressNote) {
        await attachNoteToReadingLog(savedProgressNote, readingLog);
        setSavedProgressNote(null);
      }
      await onProgressSaved(readingLog.current_page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Progress could not be saved. Try again.");
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  return (
    <div className="rj-progress-form">
      <ProgressBookSummary book={{
        id: book.id, title: book.title, author: book.authors.join(", "),
        cover: book.cover_url, currentPage, totalPages,
      }} />

      {loading && <LoadingIndicator variant="inline" label="Loading reading progress…" />}
      {totalPages === 0 && <p className="rj-muted">Set the total pages to track progress.</p>}
      {!loading && totalPages > 0 && (
        <>
          <ProgressWheels
            page={selectedPage}
            minPage={minPage}
            maxPage={totalPages}
            hours={hours}
            maxHours={6}
            minutes={minutes}
            disabled={fieldsDisabled}
            errorId={error ? errorId : undefined}
            onPageChange={setDraftPage}
            onHoursChange={setHours}
            onMinutesChange={setMinutes}
          />

          <div className="rj-progress-options">
            <Button type="button" size="sm" variant="ghost" aria-expanded={showOptions} aria-controls={showOptions ? optionsId : undefined}
              disabled={fieldsDisabled || showNoteEditor} onClick={() => setShowOptions(!showOptions)}>
              More options
            </Button>
            {showOptions && (
              <div id={optionsId} className="grid gap-3">
                {showLoggedAtEditor ? (
                  <div className="space-y-1.5">
                    <Label htmlFor={dateId} className="text-xs">Finished at (optional)</Label>
                    <Input id={dateId} type="datetime-local" value={loggedAt} disabled={fieldsDisabled} onChange={event => setLoggedAt(event.target.value)} />
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="justify-self-start" disabled={fieldsDisabled} onClick={() => setShowLoggedAtEditor(true)}>
                    Change Finished Time
                  </Button>
                )}

                {showNoteEditor ? (
                  <Suspense fallback={<LoadingIndicator variant="inline" label="Loading entry editor…" />}>
                    <JournalEntryForm
                      active
                      initialBookId={book.id}
                      entity={{ type: "Book", id: book.id }}
                      initialPageStart={selectedPage}
                      initialNoteDate={getProgressNoteDate(showLoggedAtEditor, loggedAt)}
                      preferInitialPageAndDate
                      variant="inline"
                      heading="Add entry"
                      hideEntitySelector
                      onCancel={() => toggleNoteEditor(false)}
                      onSaved={note => { if ("book_id" in note) setSavedProgressNote(note); }}
                      onSubmitSaved={() => toggleNoteEditor(false)}
                    />
                  </Suspense>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="justify-self-start" disabled={fieldsDisabled} onClick={() => toggleNoteEditor(true)}>
                    Add Entry
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {error && <p role="alert" id={errorId}>{error}</p>}
      <div className="rj-progress-footer">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        {totalPages > 0 && (
          <Button type="button" disabled={loading || saving || showNoteEditor} onClick={() => void handleSave()}>
            {saving ? "Saving…" : pendingLog ? "Retry" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
