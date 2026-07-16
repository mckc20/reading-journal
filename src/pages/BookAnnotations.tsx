import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BookOpen, NotebookPen, RefreshCw } from "lucide-react";
import AddNoteDialog from "@/components/AddNoteDialog";
import BackButton from "@/components/BackButton";
import JournalFilterSwitch from "@/components/JournalFilterSwitch";
import JournalTimeline from "@/components/JournalTimeline";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { fetchAllBookNotes, fetchBookNotes, sortBookNotes } from "@/lib/bookNotes";
import { fetchReadingLogsForBook } from "@/lib/books";
import {
  bookNotesToJournalEntries,
  buildGeneratedBookJournalEntries,
  isThoughtJournalEntry,
  sortJournalEntries,
} from "@/lib/journal";
import { suggestBookJournalTags } from "@/lib/journalTags";
import type { BookNote, ReadingLog } from "@/types";

export default function BookAnnotations() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const { books, loading: booksLoading, error: booksError, reload } = useBooksContext();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [allNotes, setAllNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(searchParams.get("new") === "1");
  const [showQuotes, setShowQuotes] = useState(true);
  const [showThoughts, setShowThoughts] = useState(true);
  const [showAutomatic, setShowAutomatic] = useState(true);

  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;

  useEffect(() => {
    if (!bookId) return;
    const currentBookId = bookId;
    let cancelled = false;

    async function run() {
      try {
        setNotesLoading(true);
        setNotesError(null);
        const data = await fetchBookNotes(currentBookId);
        if (!cancelled) {
          setNotes(data);
          setAllNotes((current) => sortBookNotes([...data, ...current.filter((note) => note.book_id !== currentBookId)]));
        }
      } catch (err) {
        if (!cancelled) {
          setNotesError(err instanceof Error ? err.message : "Failed to load journal entries");
        }
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    let cancelled = false;
    fetchAllBookNotes()
      .then((data) => {
        if (!cancelled) setAllNotes(data);
      })
      .catch(() => {
        if (!cancelled) setAllNotes([]);
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

  const notesByLabel = useMemo(
    () => ({
      quote: notes.filter((note) => note.label === "quote"),
      note: notes.filter((note) => note.label === "note"),
      review: notes.filter((note) => note.label === "review"),
    }),
    [notes],
  );

  const quoteEntries = useMemo(
    () =>
      sortJournalEntries(
        bookNotesToJournalEntries(notesByLabel.quote).map((entry) => ({
          ...entry,
          relatedBookTitle: book?.title,
        })),
      ),
    [book?.title, notesByLabel.quote],
  );

  const thoughtEntries = useMemo(
    () =>
      sortJournalEntries(
        bookNotesToJournalEntries([...notesByLabel.note, ...notesByLabel.review])
          .map((entry) => ({ ...entry, relatedBookTitle: book?.title }))
          .filter(isThoughtJournalEntry),
      ),
    [book?.title, notesByLabel.note, notesByLabel.review],
  );

  const generatedJournalEntries = useMemo(
    () => (book ? buildGeneratedBookJournalEntries(book, readingLogs) : []),
    [book, readingLogs],
  );

  const journalEntries = useMemo(
    () =>
      sortJournalEntries([
        ...(showAutomatic ? generatedJournalEntries : []),
        ...(showQuotes ? quoteEntries : []),
        ...(showThoughts ? thoughtEntries : []),
      ]),
    [generatedJournalEntries, quoteEntries, showAutomatic, showQuotes, showThoughts, thoughtEntries],
  );

  const entryCounts = {
    quote: notesByLabel.quote.length,
    thought: notesByLabel.note.length + notesByLabel.review.length,
    automatic: generatedJournalEntries.length,
  };
  const tagSuggestions = useMemo(
    () => (book ? suggestBookJournalTags(book, books, allNotes) : []),
    [allNotes, book, books],
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
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setShowEditor(true);
          }}
        >
          <NotebookPen className="mr-1.5 h-4 w-4" />
          Add entry
        </Button>
      </div>

      <AddNoteDialog
        open={showEditor}
        onOpenChange={setShowEditor}
        initialBookId={book.id}
        entity={{ type: "Book", id: book.id }}
        tagSuggestions={tagSuggestions}
        onSaved={(note) => {
          if ("book_id" in note) {
            setNotes((current) => sortBookNotes([note, ...current.filter((item) => item.id !== note.id)]));
            setAllNotes((current) => sortBookNotes([note, ...current.filter((item) => item.id !== note.id)]));
          }
        }}
      />

      {notesError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {notesError}
        </div>
      )}
      {logsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Reading history could not be added to the journal: {logsError}
        </div>
      )}

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

      {notesLoading || logsLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <JournalTimeline
          entries={journalEntries}
          emptyMessage="No journal entries yet."
          onEntryUpdated={(entry) => {
            if (entry.source !== "book_note") return;
            setNotes((current) => sortBookNotes([entry.bookNote, ...current.filter((note) => note.id !== entry.sourceId)]));
            setAllNotes((current) => sortBookNotes([entry.bookNote, ...current.filter((note) => note.id !== entry.sourceId)]));
          }}
          onEntryDeleted={(entry) => {
            setNotes((current) => current.filter((note) => note.id !== entry.sourceId));
            setAllNotes((current) => current.filter((note) => note.id !== entry.sourceId));
          }}
        />
      )}
    </div>
  );
}
