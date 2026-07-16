import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import AddJournalEntryDialog from "@/components/AddJournalEntryDialog";
import BackButton from "@/components/BackButton";
import JournalFilterSwitch from "@/components/JournalFilterSwitch";
import JournalTimeline from "@/components/JournalTimeline";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBooksContext } from "@/context/BooksContext";
import { fetchAllBookJournalEntryRecords, fetchBookJournalEntryRecords, sortBookJournalEntryRecords } from "@/lib/bookJournal";
import { fetchReadingLogsForBook } from "@/lib/books";
import {
  bookJournalToJournalEntries,
  buildGeneratedBookJournalEntries,
  getJournalEntryTags,
  isThoughtJournalEntry,
  sortJournalEntries,
  type JournalTimelineEntry,
} from "@/lib/journal";
import { READING_LOG_NOTE_TAG_PREFIX, isInternalJournalTag, normalizeJournalTags, suggestBookJournalTags } from "@/lib/journalTags";
import type { BookJournalEntryRecord, ReadingLog } from "@/types";

type JournalTimelineSortMode = "entry-date" | "date-added" | "book-progress";

function getEntryDateAddedValue(entry: JournalTimelineEntry): string {
  if (entry.source === "book_note") return entry.bookJournalEntry.created_at;
  if (entry.source === "series_note") return entry.seriesJournalEntry.created_at;
  if (entry.source === "author_note") return entry.authorJournalEntry.created_at;
  return entry.createdAt;
}

function getEntryPageStart(entry: JournalTimelineEntry): number | null {
  if (entry.source === "book_note") return entry.bookJournalEntry.page_start ?? null;
  if (entry.source === "series_note") return entry.seriesJournalEntry.page_start ?? null;
  if (entry.source === "author_note") return entry.authorJournalEntry.page_start ?? null;
  return null;
}

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
  const [allJournalEntries, setAllJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(true);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(searchParams.get("new") === "1");
  const [showQuotes, setShowQuotes] = useState(true);
  const [showThoughts, setShowThoughts] = useState(true);
  const [showAutomatic, setShowAutomatic] = useState(true);
  const [timelineSort, setTimelineSort] = useState<JournalTimelineSortMode>("entry-date");

  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;

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
          setAllJournalEntries((current) => sortBookJournalEntryRecords([...data, ...current.filter((note) => note.book_id !== currentBookId)]));
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

  useEffect(() => {
    let cancelled = false;
    fetchAllBookJournalEntryRecords()
      .then((data) => {
        if (!cancelled) setAllJournalEntries(data);
      })
      .catch(() => {
        if (!cancelled) setAllJournalEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bookId) return;
    const currentBookId = bookId;
    let cancelled = false;

    async function run() {
      try {
        setLogsLoading(true);
        setLogsError(null);
        const data = await fetchReadingLogsForBook(currentBookId);
        if (!cancelled) setReadingLogs(data);
      } catch (err) {
        if (!cancelled) {
          setReadingLogs([]);
          setLogsError(err instanceof Error ? err.message : "Failed to load reading history");
        }
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const journalEntriesByLabel = useMemo(
    () => ({
      quote: journalEntryRecords.filter((note) => note.label === "quote"),
      note: journalEntryRecords.filter((note) => note.label === "note"),
      review: journalEntryRecords.filter((note) => note.label === "review"),
    }),
    [journalEntryRecords],
  );

  const quoteEntries = useMemo(
    () =>
      sortJournalEntries(
        bookJournalToJournalEntries(journalEntriesByLabel.quote).map((entry) => ({
          ...entry,
          relatedBookTitle: book?.title,
        })),
      ),
    [book?.title, journalEntriesByLabel.quote],
  );

  const thoughtEntries = useMemo(
    () =>
      sortJournalEntries(
        bookJournalToJournalEntries([...journalEntriesByLabel.note, ...journalEntriesByLabel.review])
          .map((entry) => ({ ...entry, relatedBookTitle: book?.title }))
          .filter(isThoughtJournalEntry),
      ),
    [book?.title, journalEntriesByLabel.note, journalEntriesByLabel.review],
  );

  const uncompressedReadingLogIds = useMemo(() => {
    const ids = new Set<string>();
    journalEntryRecords.forEach((note) => {
      normalizeJournalTags(note.tags).forEach((tag) => {
        if (tag.startsWith(READING_LOG_NOTE_TAG_PREFIX)) {
          ids.add(tag.slice(READING_LOG_NOTE_TAG_PREFIX.length));
        }
      });
    });
    return ids;
  }, [journalEntryRecords]);

  const sessionBarrierEntries = useMemo(
    () => journalEntryRecords.filter((note) => !normalizeJournalTags(note.tags).some(isInternalJournalTag)),
    [journalEntryRecords],
  );
  const sessionBarrierPages = useMemo(
    () => new Set(
      sessionBarrierEntries
        .map((note) => note.page_start)
        .filter((page): page is number => typeof page === "number" && page > 0),
    ),
    [sessionBarrierEntries],
  );
  const sessionBarrierDateKeys = useMemo(
    () => new Set(
      sessionBarrierEntries
        .filter((note) => !note.page_start)
        .map((note) => note.entry_date.slice(0, 10)),
    ),
    [sessionBarrierEntries],
  );

  const generatedJournalEntries = useMemo(
    () => (book ? buildGeneratedBookJournalEntries(book, readingLogs, { uncompressedReadingLogIds, sessionBarrierDateKeys, sessionBarrierPages }) : []),
    [book, readingLogs, sessionBarrierDateKeys, sessionBarrierPages, uncompressedReadingLogIds],
  );

  const readingLogProgressById = useMemo(
    () => new Map(readingLogs.map((log) => [log.id, log.current_page])),
    [readingLogs],
  );

  const getBookProgressSortValue = useMemo(
    () => (entry: JournalTimelineEntry): number | null => {
      const pageStart = getEntryPageStart(entry);
      if (typeof pageStart === "number" && pageStart > 0) return pageStart;

      const linkedReadingLogTag = normalizeJournalTags(getJournalEntryTags(entry)).find((tag) => tag.startsWith(READING_LOG_NOTE_TAG_PREFIX));
      if (linkedReadingLogTag) {
        const linkedPage = readingLogProgressById.get(linkedReadingLogTag.slice(READING_LOG_NOTE_TAG_PREFIX.length));
        if (typeof linkedPage === "number") return linkedPage;
      }

      if (entry.source === "generated_book_event" && entry.type === "reading_session" && typeof entry.metadata?.currentPage === "number") {
        return entry.metadata.currentPage;
      }

      return null;
    },
    [readingLogProgressById],
  );

  const timelineEntries = useMemo(
    () => {
      const entries = [
        ...(showAutomatic ? generatedJournalEntries : []),
        ...(showQuotes ? quoteEntries : []),
        ...(showThoughts ? thoughtEntries : []),
      ];

      if (timelineSort === "date-added") {
        return [...entries].sort((a, b) => {
          const addedCompare = getEntryDateAddedValue(b).localeCompare(getEntryDateAddedValue(a));
          if (addedCompare !== 0) return addedCompare;
          return compareStableEntryTie(a, b);
        });
      }

      if (timelineSort === "book-progress") {
        return [...entries].sort((a, b) => {
          const aProgress = getBookProgressSortValue(a);
          const bProgress = getBookProgressSortValue(b);

          if (aProgress !== null && bProgress !== null && aProgress !== bProgress) return bProgress - aProgress;
          if (aProgress !== null && bProgress === null) return -1;
          if (aProgress === null && bProgress !== null) return 1;
          return compareEntryDateStable(a, b);
        });
      }

      return [...entries].sort(compareEntryDateStable);
    },
    [generatedJournalEntries, getBookProgressSortValue, quoteEntries, showAutomatic, showQuotes, showThoughts, thoughtEntries, timelineSort],
  );

  const entryCounts = {
    quote: journalEntriesByLabel.quote.length,
    thought: journalEntriesByLabel.note.length + journalEntriesByLabel.review.length,
    automatic: generatedJournalEntries.length,
  };
  const tagSuggestions = useMemo(
    () => (book ? suggestBookJournalTags(book, books, allJournalEntries) : []),
    [allJournalEntries, book, books],
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
      </div>

      <AddJournalEntryDialog
        open={showEditor}
        onOpenChange={setShowEditor}
        initialBookId={book.id}
        entity={{ type: "Book", id: book.id }}
        tagSuggestions={tagSuggestions}
        onSaved={(note) => {
          if ("book_id" in note) {
            setJournalEntryRecords((current) => sortBookJournalEntryRecords([note, ...current.filter((item) => item.id !== note.id)]));
            setAllJournalEntries((current) => sortBookJournalEntryRecords([note, ...current.filter((item) => item.id !== note.id)]));
          }
        }}
      />

      {journalEntriesError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {journalEntriesError}
        </div>
      )}
      {logsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Reading history could not be added to the journal: {logsError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <JournalFilterSwitch
            checked={showQuotes}
            label="Quotes"
            count={entryCounts.quote}
            onCheckedChange={setShowQuotes}
          />
          <JournalFilterSwitch
            checked={showThoughts}
            label="Thoughts"
            count={entryCounts.thought}
            onCheckedChange={setShowThoughts}
          />
          <JournalFilterSwitch
            checked={showAutomatic}
            label="Automatic"
            count={entryCounts.automatic}
            onCheckedChange={setShowAutomatic}
          />
        </div>
        <Select value={timelineSort} onValueChange={(value) => setTimelineSort(value as JournalTimelineSortMode)}>
          <SelectTrigger className="w-[13.5rem] justify-between gap-1.5" aria-label="Sort journal timeline">
            <span className="text-muted-foreground">Sort by:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="entry-date">Entry Date</SelectItem>
            <SelectItem value="date-added">Date Added</SelectItem>
            <SelectItem value="book-progress">Book Progress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {journalEntriesLoading || logsLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <JournalTimeline
          entries={timelineEntries}
          generatedReferenceEntries={generatedJournalEntries}
          sortMode={timelineSort}
          emptyMessage="No journal entries yet."
          onEntryUpdated={(entry) => {
            if (entry.source !== "book_note") return;
            setJournalEntryRecords((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
            setAllJournalEntries((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
          }}
          onEntryCreated={(entry) => {
            if (entry.source !== "book_note") return;
            setJournalEntryRecords((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
            setAllJournalEntries((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
          }}
          onEntryDeleted={(entry) => {
            setJournalEntryRecords((current) => current.filter((note) => note.id !== entry.sourceId));
            setAllJournalEntries((current) => current.filter((note) => note.id !== entry.sourceId));
          }}
        />
      )}
    </div>
  );
}
