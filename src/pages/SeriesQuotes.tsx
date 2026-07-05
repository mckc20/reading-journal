import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import AnnotationCard from "@/components/AnnotationCard";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { fetchAllBookNotes } from "@/lib/bookNotes";
import { getSeriesQuoteEntries, sortSeriesBooks } from "@/lib/seriesDetails";
import type { BookNote } from "@/types";

const PREVIEW_QUOTES_PER_BOOK = 2;

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function SeriesQuotes() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let ignore = false;
    fetchAllBookNotes()
      .then((data) => {
        if (!ignore) setNotes(data);
      })
      .catch((error) => {
        if (!ignore) setNotesError(error instanceof Error ? error.message : "Failed to load quotes");
      })
      .finally(() => {
        if (!ignore) setNotesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const seriesRecord = series.find((item) => item.id === seriesId) ?? null;
  const seriesBooks = useMemo(
    () => sortSeriesBooks(books.filter((book) => book.series_id === seriesId)),
    [books, seriesId],
  );
  const quoteEntries = useMemo(
    () => getSeriesQuoteEntries(seriesBooks, notes, { sort: "newest" }),
    [notes, seriesBooks],
  );
  const quoteGroups = useMemo(
    () =>
      seriesBooks
        .map((book) => ({
          book,
          entries: quoteEntries.filter((entry) => entry.book.id === book.id),
        }))
        .filter((group) => group.entries.length > 0),
    [quoteEntries, seriesBooks],
  );

  function expandBookQuotes(bookId: string) {
    setExpandedBookIds((current) => {
      const next = new Set(current);
      next.add(bookId);
      return next;
    });
  }

  if (booksLoading || seriesLoading || notesLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  if (booksError || seriesError || notesError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{booksError || seriesError || notesError}</div>;
  }

  if (!seriesRecord) {
    return (
      <div className="space-y-4">
        <BackButton fallbackTo="/series" />
        <EmptyState message="This series was not found in your library." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo={`/series/${seriesRecord.id}`} />
      <div>
        <p className="text-sm text-muted-foreground">{seriesRecord.name}</p>
        <h1 className="font-heading text-3xl font-medium leading-tight sm:text-4xl">Quotes</h1>
      </div>

      {quoteGroups.length === 0 ? (
        <EmptyState message="Quotes from this series will appear here." />
      ) : (
        <div className="space-y-8">
          {quoteGroups.map(({ book, entries }) => {
            const expanded = expandedBookIds.has(book.id);
            const visibleEntries = expanded ? entries : entries.slice(0, PREVIEW_QUOTES_PER_BOOK);
            const hiddenCount = entries.length - PREVIEW_QUOTES_PER_BOOK;

            return (
              <section key={book.id} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                  <h2 className="font-heading text-2xl font-medium leading-snug">{book.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {entries.length} quote{entries.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {visibleEntries.map(({ note }) => (
                    <AnnotationCard key={note.id} note={note} bookId={book.id} bookTitle={book.title} />
                  ))}
                </div>
                {!expanded && entries.length > PREVIEW_QUOTES_PER_BOOK && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-muted-foreground"
                    onClick={() => expandBookQuotes(book.id)}
                  >
                    Show {hiddenCount} more
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
