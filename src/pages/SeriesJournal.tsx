import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, NotebookPen } from "lucide-react";
import AddJournalEntryDialog from "@/components/AddJournalEntryDialog";
import BackButton from "@/components/BackButton";
import JournalFilterSwitch from "@/components/JournalFilterSwitch";
import JournalTimeline from "@/components/JournalTimeline";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { fetchAllBookJournalEntryRecords, sortBookJournalEntryRecords } from "@/lib/bookJournal";
import {
  bookJournalEntryToRelatedJournalEntry,
  buildGeneratedSeriesJournalEntries,
  seriesJournalToJournalEntries,
  sortJournalEntries,
} from "@/lib/journal";
import { suggestSeriesJournalTags } from "@/lib/journalTags";
import { fetchSeriesJournalEntryRecords, sortSeriesJournalEntryRecords } from "@/lib/seriesJournal";
import { sortSeriesBooks } from "@/lib/seriesDetails";
import type { Book, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";

function BookJournalLink({ book }: { book: Book }) {
  return (
    <Link to={`/books/${book.id}/journal`} className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:text-primary">
      <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {book.cover_url ? <img src={book.cover_url} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-medium">{book.title}</p>
        <p className="text-xs text-muted-foreground">Open book journal</p>
      </div>
    </Link>
  );
}

export default function SeriesJournal() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const { user } = useAuth();
  const { books, loading: booksLoading } = useBooksContext();
  const { series, loading: seriesLoading } = useSeries();
  const [journalEntries, setJournalEntries] = useState<SeriesJournalEntryRecord[]>([]);
  const [allBookJournalEntryRecords, setAllBookJournalEntryRecords] = useState<BookJournalEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [showQuotes, setShowQuotes] = useState(true);
  const [showThoughts, setShowThoughts] = useState(true);
  const [showAutomatic, setShowAutomatic] = useState(true);
  const [showBookEntries, setShowBookEntries] = useState(true);

  const seriesRecord = series.find((item) => item.id === seriesId) ?? null;
  const seriesBooks = useMemo(
    () => sortSeriesBooks(books.filter((book) => book.series_id === seriesId)),
    [books, seriesId],
  );

  useEffect(() => {
    if (!seriesId) return;
    let cancelled = false;
    setLoading(true);
    fetchSeriesJournalEntryRecords(seriesId)
      .then((data) => {
        if (!cancelled) setJournalEntries(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load series journal");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  useEffect(() => {
    let cancelled = false;
    fetchAllBookJournalEntryRecords()
      .then((data) => {
        if (!cancelled) setAllBookJournalEntryRecords(data);
      })
      .catch(() => {
        if (!cancelled) setAllBookJournalEntryRecords([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seriesBookById = useMemo(() => new Map(seriesBooks.map((book) => [book.id, book])), [seriesBooks]);
  const relatedBookJournalEntryRecords = useMemo(
    () => allBookJournalEntryRecords.filter((note) => seriesBookById.has(note.book_id)),
    [allBookJournalEntryRecords, seriesBookById],
  );

  const ownQuoteEntries = useMemo(
    () => sortJournalEntries(seriesJournalToJournalEntries(journalEntries.filter((note) => note.label === "quote"))),
    [journalEntries],
  );
  const bookQuoteEntries = useMemo(
    () =>
      sortJournalEntries(
        relatedBookJournalEntryRecords
          .filter((note) => note.label === "quote")
          .map((note) =>
            bookJournalEntryToRelatedJournalEntry(note, {
              entityType: "Series",
              entityId: seriesId ?? "",
              bookTitle: seriesBookById.get(note.book_id)?.title,
              context: "series",
            }),
          ),
      ),
    [relatedBookJournalEntryRecords, seriesBookById, seriesId],
  );
  const quoteEntries = useMemo(
    () => sortJournalEntries([...ownQuoteEntries, ...(showBookEntries ? bookQuoteEntries : [])]),
    [bookQuoteEntries, ownQuoteEntries, showBookEntries],
  );
  const ownThoughtEntries = useMemo(
    () => sortJournalEntries(seriesJournalToJournalEntries(journalEntries.filter((note) => note.label !== "quote"))),
    [journalEntries],
  );
  const bookThoughtEntries = useMemo(
    () =>
      sortJournalEntries(
        relatedBookJournalEntryRecords
          .filter((note) => note.label !== "quote")
          .map((note) =>
            bookJournalEntryToRelatedJournalEntry(note, {
              entityType: "Series",
              entityId: seriesId ?? "",
              bookTitle: seriesBookById.get(note.book_id)?.title,
              context: "series",
            }),
          ),
      ),
    [relatedBookJournalEntryRecords, seriesBookById, seriesId],
  );
  const thoughtEntries = useMemo(
    () => sortJournalEntries([...ownThoughtEntries, ...(showBookEntries ? bookThoughtEntries : [])]),
    [bookThoughtEntries, ownThoughtEntries, showBookEntries],
  );
  const automaticEntries = useMemo(
    () => (seriesId ? buildGeneratedSeriesJournalEntries(seriesId, seriesBooks) : []),
    [seriesBooks, seriesId],
  );
  const entries = useMemo(
    () =>
      sortJournalEntries([
        ...(showAutomatic ? automaticEntries : []),
        ...(showQuotes ? quoteEntries : []),
        ...(showThoughts ? thoughtEntries : []),
      ]),
    [automaticEntries, quoteEntries, showAutomatic, showQuotes, showThoughts, thoughtEntries],
  );
  const tagSuggestions = useMemo(() => suggestSeriesJournalTags(journalEntries), [journalEntries]);

  if (booksLoading || seriesLoading || loading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  if (!seriesRecord) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Series not found.</div>;
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo={`/series/${seriesRecord.id}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{seriesRecord.name}</p>
          <h1 className="text-2xl font-heading leading-snug font-medium">Journal</h1>
        </div>
        <Button type="button" size="sm" onClick={() => setComposerOpen(true)} disabled={!user}>
          <NotebookPen className="mr-1.5 h-4 w-4" />
          Add entry
        </Button>
      </div>

      <AddJournalEntryDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        entity={{ type: "Series", id: seriesRecord.id }}
        tagSuggestions={tagSuggestions}
        onSaved={(note) => {
          if ("series_id" in note) setJournalEntries((current) => sortSeriesJournalEntryRecords([note, ...current.filter((item) => item.id !== note.id)]));
        }}
      />

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {seriesBooks.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seriesBooks.map((book) => <BookJournalLink key={book.id} book={book} />)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <JournalFilterSwitch checked={showQuotes} label="Quotes" count={quoteEntries.length} onCheckedChange={setShowQuotes} />
        <JournalFilterSwitch checked={showThoughts} label="Thoughts" count={thoughtEntries.length} onCheckedChange={setShowThoughts} />
        <JournalFilterSwitch checked={showAutomatic} label="Automatic" count={automaticEntries.length} onCheckedChange={setShowAutomatic} />
        <JournalFilterSwitch
          checked={showBookEntries}
          label="From books"
          count={bookQuoteEntries.length + bookThoughtEntries.length}
          onCheckedChange={setShowBookEntries}
        />
      </div>

      <JournalTimeline
        entries={entries}
        emptyMessage="Series journal entries will appear here."
        onEntryUpdated={(entry) => {
          if (entry.source === "series_note") setJournalEntries((current) => sortSeriesJournalEntryRecords([entry.seriesJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
          if (entry.source === "book_note") setAllBookJournalEntryRecords((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
        }}
        onEntryDeleted={(entry) => {
          if (entry.source === "series_note") setJournalEntries((current) => current.filter((note) => note.id !== entry.sourceId));
          if (entry.source === "book_note") setAllBookJournalEntryRecords((current) => current.filter((note) => note.id !== entry.sourceId));
        }}
      />
    </div>
  );
}
