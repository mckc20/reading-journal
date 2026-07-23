import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BookOpen, NotebookPen, RefreshCw } from "lucide-react";
import BackButton from "@/components/BackButton";
import JournalTimeline from "@/components/JournalTimeline";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useBooksContext } from "@/context/BooksContext";
import { fetchBookJournalEntryRecords, sortBookJournalEntryRecords } from "@/lib/bookJournal";
import { bookJournalToJournalEntries, sortJournalEntries, type JournalTimelineEntry } from "@/lib/journal";
import type { BookJournalEntryRecord } from "@/types";

type JournalViewMode = "list" | "book";

function compareStableEntryTie(left: JournalTimelineEntry, right: JournalTimelineEntry): number {
  return right.id.localeCompare(left.id);
}

function compareEntryDateStable(left: JournalTimelineEntry, right: JournalTimelineEntry): number {
  const dateCompare = right.createdAt.localeCompare(left.createdAt);
  if (dateCompare !== 0) return dateCompare;
  return compareStableEntryTie(left, right);
}

export default function BookAnnotations() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const { books, loading: booksLoading, error: booksError, reload } = useBooksContext();
  const [journalEntryRecords, setJournalEntryRecords] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(true);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(searchParams.get("new") === "1");
  const [viewMode, setViewMode] = useState<JournalViewMode>("list");
  const { user } = useAuth();

  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;
  const selectedEntryId = searchParams.get("entry");

  useEffect(() => {
    if (searchParams.get("new") === "1") setComposerOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!bookId) return;
    const currentBookId = bookId;
    let cancelled = false;

    async function run() {
      try {
        setJournalEntriesLoading(true);
        setJournalEntriesError(null);
        const data = await fetchBookJournalEntryRecords(currentBookId);
        if (!cancelled) {
          setJournalEntryRecords(data);
        }
      } catch (err) {
        if (!cancelled) {
          setJournalEntriesError(err instanceof Error ? err.message : "Failed to load journal entries");
        }
      } finally {
        if (!cancelled) setJournalEntriesLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const timelineEntries = useMemo(
    () =>
      sortJournalEntries(
        bookJournalToJournalEntries(journalEntryRecords).map((entry) => ({
          ...entry,
          relatedBookTitle: book?.title,
        })),
      ).sort(compareEntryDateStable),
    [book?.title, journalEntryRecords],
  );
  if (booksLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (booksError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{booksError}</p>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-lg font-heading leading-snug font-medium">Book not found</h1>
        <BackButton fallbackTo="/library" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo="/library" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{book.title}</p>
          <h1 className="text-2xl font-heading leading-snug font-medium">Journal</h1>
        </div>
        <Button type="button" size="sm" onClick={() => setComposerOpen(true)} disabled={!user}>
          <NotebookPen className="mr-1.5 h-4 w-4" />
          Add entry
        </Button>
      </div>

      {journalEntriesError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {journalEntriesError}
        </div>
      )}

      <div className="flex justify-end">
        <Select value={viewMode} onValueChange={(value) => setViewMode(value as JournalViewMode)}>
          <SelectTrigger className="w-[11rem] justify-between gap-1.5" aria-label="Journal view">
            <span className="text-muted-foreground">View:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="book" disabled>Book</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {journalEntriesLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <JournalTimeline
          entries={timelineEntries}
          layout="pages"
          selectedEntryId={selectedEntryId}
          inlineComposer={{
            open: composerOpen,
            entity: { type: "Book", id: book.id },
            initialBookId: book.id,
            onOpenChange: setComposerOpen,
          }}
          emptyMessage="No journal entries yet."
          onEntryUpdated={(entry) => {
            if (entry.source !== "book_note") return;
            setJournalEntryRecords((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
          }}
          onEntryCreated={(entry) => {
            if (entry.source !== "book_note") return;
            setJournalEntryRecords((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
          }}
          onEntryDeleted={(entry) => {
            setJournalEntryRecords((current) => current.filter((note) => note.id !== entry.sourceId));
          }}
        />
      )}
    </div>
  );
}
