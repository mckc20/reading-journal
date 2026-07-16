import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, NotebookPen } from "lucide-react";
import AddJournalEntryDialog from "@/components/AddJournalEntryDialog";
import BackButton from "@/components/BackButton";
import JournalFilterSwitch from "@/components/JournalFilterSwitch";
import JournalTimeline from "@/components/JournalTimeline";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { fetchAllBookJournalEntryRecords, sortBookJournalEntryRecords } from "@/lib/bookJournal";
import {
  authorJournalToJournalEntries,
  bookJournalEntryToRelatedJournalEntry,
  buildGeneratedAuthorJournalEntries,
  sortJournalEntries,
} from "@/lib/journal";
import { suggestAuthorJournalTags } from "@/lib/journalTags";
import { fetchAuthorJournalEntryRecords, sortAuthorJournalEntryRecords } from "@/lib/authorJournal";
import type { AuthorJournalEntryRecord, Book, BookJournalEntryRecord } from "@/types";

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

export default function AuthorJournal() {
  const { authorId } = useParams<{ authorId: string }>();
  const { user } = useAuth();
  const { authors, loading: authorsLoading } = useAuthorsContext();
  const { books, loading: booksLoading } = useBooksContext();
  const [journalEntries, setJournalEntries] = useState<AuthorJournalEntryRecord[]>([]);
  const [allBookJournalEntryRecords, setAllBookJournalEntryRecords] = useState<BookJournalEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [showQuotes, setShowQuotes] = useState(true);
  const [showThoughts, setShowThoughts] = useState(true);
  const [showAutomatic, setShowAutomatic] = useState(true);
  const [showBookEntries, setShowBookEntries] = useState(true);

  const author = authors.find((item) => item.id === authorId) ?? null;
  const authorBooks = useMemo(
    () => author ? books.filter((book) => book.authors.some((name) => name.toLocaleLowerCase() === author.name.toLocaleLowerCase())) : [],
    [author, books],
  );
  const authorBookById = useMemo(() => new Map(authorBooks.map((book) => [book.id, book])), [authorBooks]);
  const relatedBookJournalEntryRecords = useMemo(
    () => allBookJournalEntryRecords.filter((note) => authorBookById.has(note.book_id)),
    [allBookJournalEntryRecords, authorBookById],
  );

  useEffect(() => {
    if (!authorId) return;
    let cancelled = false;
    setLoading(true);
    fetchAuthorJournalEntryRecords(authorId)
      .then((data) => {
        if (!cancelled) setJournalEntries(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load author journal");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authorId]);

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

  const ownQuoteEntries = useMemo(
    () => sortJournalEntries(authorJournalToJournalEntries(journalEntries.filter((note) => note.label === "quote"))),
    [journalEntries],
  );
  const bookQuoteEntries = useMemo(
    () =>
      sortJournalEntries(
        relatedBookJournalEntryRecords
          .filter((note) => note.label === "quote")
          .map((note) =>
            bookJournalEntryToRelatedJournalEntry(note, {
              entityType: "Author",
              entityId: authorId ?? "",
              bookTitle: authorBookById.get(note.book_id)?.title,
              context: "author",
            }),
          ),
      ),
    [authorBookById, authorId, relatedBookJournalEntryRecords],
  );
  const quoteEntries = useMemo(
    () => sortJournalEntries([...ownQuoteEntries, ...(showBookEntries ? bookQuoteEntries : [])]),
    [bookQuoteEntries, ownQuoteEntries, showBookEntries],
  );
  const ownThoughtEntries = useMemo(
    () => sortJournalEntries(authorJournalToJournalEntries(journalEntries.filter((note) => note.label !== "quote"))),
    [journalEntries],
  );
  const bookThoughtEntries = useMemo(
    () =>
      sortJournalEntries(
        relatedBookJournalEntryRecords
          .filter((note) => note.label !== "quote")
          .map((note) =>
            bookJournalEntryToRelatedJournalEntry(note, {
              entityType: "Author",
              entityId: authorId ?? "",
              bookTitle: authorBookById.get(note.book_id)?.title,
              context: "author",
            }),
          ),
      ),
    [authorBookById, authorId, relatedBookJournalEntryRecords],
  );
  const thoughtEntries = useMemo(
    () => sortJournalEntries([...ownThoughtEntries, ...(showBookEntries ? bookThoughtEntries : [])]),
    [bookThoughtEntries, ownThoughtEntries, showBookEntries],
  );
  const automaticEntries = useMemo(
    () => (author ? buildGeneratedAuthorJournalEntries(author.name, author.id, authorBooks) : []),
    [author, authorBooks],
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
  const tagSuggestions = useMemo(
    () => suggestAuthorJournalTags(authorBooks, allBookJournalEntryRecords),
    [allBookJournalEntryRecords, authorBooks],
  );

  if (authorsLoading || booksLoading || loading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  if (!author) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Author not found.</div>;
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo={`/authors/${author.id}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{author.name}</p>
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
        entity={{ type: "Author", id: author.id }}
        tagSuggestions={tagSuggestions}
        onSaved={(note) => {
          if ("author_id" in note) setJournalEntries((current) => sortAuthorJournalEntryRecords([note, ...current.filter((item) => item.id !== note.id)]));
        }}
      />

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {authorBooks.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {authorBooks.map((book) => <BookJournalLink key={book.id} book={book} />)}
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
        emptyMessage="Author journal entries will appear here."
        onEntryUpdated={(entry) => {
          if (entry.source === "author_note") setJournalEntries((current) => sortAuthorJournalEntryRecords([entry.authorJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
          if (entry.source === "book_note") setAllBookJournalEntryRecords((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
        }}
        onEntryDeleted={(entry) => {
          if (entry.source === "author_note") setJournalEntries((current) => current.filter((note) => note.id !== entry.sourceId));
          if (entry.source === "book_note") setAllBookJournalEntryRecords((current) => current.filter((note) => note.id !== entry.sourceId));
        }}
      />
    </div>
  );
}
