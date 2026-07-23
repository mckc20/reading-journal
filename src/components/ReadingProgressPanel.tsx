import { useState, useEffect, useMemo } from "react";
import { BookOpen, History, NotebookPen } from "lucide-react";
import { JournalEntryForm } from "@/components/AddJournalEntryDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollWheelPicker } from "@/components/ui/scroll-wheel-picker";
import { getProgressNoteDate, updateBookJournalEntryRecord } from "@/lib/bookJournal";
import { createReadingLog, fetchLastReadingLog } from "@/lib/books";
import { useAuth } from "@/context/AuthContext";
import { READING_LOG_NOTE_TAG_PREFIX, normalizeJournalTags } from "@/lib/journalTags";
import type { Book, BookJournalEntryRecord, ReadingLog } from "@/types";

interface ReadingProgressPanelProps {
  book: Book;
  onProgressSaved: (newCurrentPage: number) => void;
  defaultExpanded?: boolean;
  hideTrigger?: boolean;
  onCancel?: () => void;
  onEntryComposerOpenChange?: (open: boolean) => void;
}

function buildPageItems(min: number, max: number) {
  const items: { value: number; label: string }[] = [];
  for (let p = min; p <= max; p++) {
    items.push({ value: p, label: String(p) });
  }
  return items;
}

function toDateTimeLocalValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

const HOUR_ITEMS = Array.from({ length: 7 }, (_, i) => ({
  value: i,
  label: `${i}h`,
}));

const MINUTE_ITEMS = Array.from({ length: 12 }, (_, i) => ({
  value: i * 5,
  label: `${(i * 5).toString().padStart(2, "0")}m`,
}));

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
  book,
  onProgressSaved,
  defaultExpanded = false,
  hideTrigger = false,
  onCancel,
  onEntryComposerOpenChange,
}: ReadingProgressPanelProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [lastLog, setLastLog] = useState<ReadingLog | null>(null);
  const [loadingLog, setLoadingLog] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalPages = book.total_pages ?? 0;

  // Initial page value: start one step above current
  const minPage = Math.max(book.current_page ?? 0, lastLog?.current_page ?? 0);
  const startPage = Math.min(minPage + 1, totalPages);

  const [selectedPage, setSelectedPage] = useState(startPage);
  const [selectedHours, setSelectedHours] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [showLoggedAtEditor, setShowLoggedAtEditor] = useState(false);
  const [selectedLoggedAt, setSelectedLoggedAt] = useState(() =>
    toDateTimeLocalValue(new Date())
  );
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [savedProgressNote, setSavedProgressNote] = useState<BookJournalEntryRecord | null>(null);

  // Fetch last reading log on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const log = await fetchLastReadingLog(book.id);
        if (!cancelled) setLastLog(log);
      } catch {
        // silently ignore — we'll just use book.current_page as min
      } finally {
        if (!cancelled) setLoadingLog(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [book.id]);

  // Reset picker values when expanding or when lastLog loads
  useEffect(() => {
    if (expanded) {
      const min = Math.max(book.current_page ?? 0, lastLog?.current_page ?? 0);
      setSelectedPage(Math.min(min + 1, totalPages));
      setSelectedHours(0);
      setSelectedMinutes(0);
      setShowLoggedAtEditor(false);
      setSelectedLoggedAt(toDateTimeLocalValue(new Date()));
      setShowNoteEditor(false);
      setSavedProgressNote(null);
      onEntryComposerOpenChange?.(false);
      setErrorMsg(null);
    }
  }, [expanded, lastLog, book.current_page, totalPages, onEntryComposerOpenChange]);

  const pageItems = useMemo(
    () => buildPageItems(minPage + 1, totalPages),
    [minPage, totalPages]
  );

  async function handleSave() {
    if (!user) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      const timeMinutes = selectedHours * 60 + selectedMinutes;
      let loggedAtIso: string | undefined;

      if (showLoggedAtEditor && selectedLoggedAt) {
        const parsedDate = new Date(selectedLoggedAt);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new Error("Invalid date/time for progress entry");
        }
        loggedAtIso = parsedDate.toISOString();
      }

      const readingLog = await createReadingLog(
        book.id,
        user.id,
        selectedPage,
        timeMinutes > 0 ? timeMinutes : undefined,
        loggedAtIso
      );

      if (savedProgressNote) {
        await attachNoteToReadingLog(savedProgressNote, readingLog);
      }

      await onProgressSaved(selectedPage);
      // Update lastLog locally so the min page updates
      setLastLog(readingLog);
      setSavedProgressNote(null);
      setShowNoteEditor(false);
      onEntryComposerOpenChange?.(false);
      setExpanded(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save progress");
    } finally {
      setSaving(false);
    }
  }

  if (totalPages === 0) {
    return (
      <div className="rounded-md border bg-background/80 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Set the total pages to track progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!expanded && !hideTrigger && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loadingLog}
          onClick={() => setExpanded(true)}
        >
          <BookOpen className="h-3.5 w-3.5 mr-1.5" />
          Update progress
        </Button>
      )}

      {expanded && (
        <div className="space-y-4 rounded-lg border bg-background/80 p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Read up to page</Label>
            <ScrollWheelPicker
              items={pageItems}
              selectedValue={selectedPage}
              onChange={setSelectedPage}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Time spent reading (optional)
            </Label>
            <div className="flex gap-2">
              <ScrollWheelPicker
                items={HOUR_ITEMS}
                selectedValue={selectedHours}
                onChange={setSelectedHours}
                className="flex-1"
              />
              <ScrollWheelPicker
                items={MINUTE_ITEMS}
                selectedValue={selectedMinutes}
                onChange={setSelectedMinutes}
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            {!showLoggedAtEditor && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-primary hover:bg-transparent hover:text-primary/85"
                onClick={() => setShowLoggedAtEditor(true)}
              >
                <History className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Change Finished Time
              </Button>
            )}

            {showLoggedAtEditor && (
              <div className="space-y-1.5">
                <Label htmlFor="progress-logged-at" className="text-xs text-muted-foreground">
                  Finished at (optional)
                </Label>
                <Input
                  id="progress-logged-at"
                  type="datetime-local"
                  value={selectedLoggedAt}
                  onChange={(event) => setSelectedLoggedAt(event.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            {!showNoteEditor && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="border border-note/60 bg-transparent text-note hover:border-note hover:bg-transparent hover:text-note"
                onClick={() => {
                  setShowNoteEditor(true);
                  onEntryComposerOpenChange?.(true);
                }}
              >
                <NotebookPen className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add Entry
              </Button>
            )}

            {showNoteEditor && (
              <div className="pt-1">
                <JournalEntryForm
                  active={showNoteEditor}
                  initialBookId={book.id}
                  entity={{ type: "Book", id: book.id }}
                  initialEntry={null}
                  initialPageStart={selectedPage}
                  initialNoteDate={getProgressNoteDate(showLoggedAtEditor, selectedLoggedAt)}
                  preferInitialPageAndDate
                  variant="inline"
                  heading="Add entry"
                  hideEntitySelector
                  onCancel={() => {
                    setShowNoteEditor(false);
                    onEntryComposerOpenChange?.(false);
                  }}
                  onSaved={(note) => {
                    if ("book_id" in note) setSavedProgressNote(note);
                    setShowNoteEditor(false);
                    onEntryComposerOpenChange?.(false);
                  }}
                />
              </div>
            )}
          </div>

          {errorMsg && (
            <p className="text-xs text-destructive">{errorMsg}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                if (onCancel) {
                  onEntryComposerOpenChange?.(false);
                  onCancel();
                  return;
                }
                onEntryComposerOpenChange?.(false);
                setExpanded(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
