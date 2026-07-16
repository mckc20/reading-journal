import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, Grid2X2, Timeline } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookCard from "@/components/BookCard";
import BookTimeline, { type BookTimelineItem } from "@/components/BookTimeline";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { buildAuthorSummaries, findAuthorSummary } from "@/lib/authorShelf";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import { fetchReadingLogs } from "@/lib/books";
import type { Book, BookJournalEntryRecord, ReadingLog, Series } from "@/types";

type AuthorDisplay = "cards" | "timeline";
type AuthorTimelineSort = "publication-date" | "read-date" | "date-added";

function normalizeDisplay(value: string | null): AuthorDisplay {
  if (value === "timeline" || value === "cards") return value;
  if (value === "grid") return "cards";
  return "cards";
}

function normalizeTimelineSort(value: string | null): AuthorTimelineSort {
  if (value === "publication-date" || value === "read-date" || value === "date-added") return value;
  return "publication-date";
}

function getSeriesLabel(book: Book, series: Series[]): string {
  const seriesName = book.series_id ? series.find((item) => item.id === book.series_id)?.name ?? "" : "";
  if (!seriesName) return "";
  return book.volume_number != null ? `${seriesName} · Book ${book.volume_number}` : seriesName;
}

function formatTimelineLabel(
  value: string | null | undefined,
  sort: AuthorTimelineSort,
): { year: string; month: string } {
  if (!value) return sort === "read-date" ? { year: "To Read", month: "" } : { year: "Unknown", month: "" };

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return { year: "Unknown", month: "" };

  return {
    year: date.getFullYear().toString(),
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
  };
}

function formatTimelineGroupKey(
  value: string | null | undefined,
  sort: AuthorTimelineSort,
): string {
  if (!value) return sort === "read-date" ? "unread" : "unknown";

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return "unknown";

  return `${date.getFullYear()}-${date.getMonth()}`;
}

function getReadingLogDateByBook(readingLogs: ReadingLog[]): Map<string, string> {
  const latestByBook = new Map<string, string>();

  for (const log of readingLogs) {
    const current = latestByBook.get(log.book_id);
    if (!current || new Date(log.logged_at).getTime() > new Date(current).getTime()) {
      latestByBook.set(log.book_id, log.logged_at);
    }
  }

  return latestByBook;
}

function getTimelineSortDate(book: Book, sort: AuthorTimelineSort, latestReadDateByBook: Map<string, string>): string | null {
  if (sort === "date-added") return book.created_at ?? null;
  if (sort === "read-date") return latestReadDateByBook.get(book.id) ?? book.date_finished ?? book.date_started ?? null;
  return book.publication_date ?? null;
}

function sortTimelineBooks(
  books: Book[],
  sort: AuthorTimelineSort,
  latestReadDateByBook: Map<string, string>,
): Book[] {
  return [...books].sort((a, b) => {
    const aValue = getTimelineSortDate(a, sort, latestReadDateByBook);
    const bValue = getTimelineSortDate(b, sort, latestReadDateByBook);
    const aTime = aValue ? new Date(aValue).getTime() : Number.NEGATIVE_INFINITY;
    const bTime = bValue ? new Date(bValue).getTime() : Number.NEGATIVE_INFINITY;
    return bTime - aTime || a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
  });
}

function LoadingAuthors() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-[18rem] animate-pulse rounded-2xl bg-muted/40" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function BooksGrid({ books, onBook }: { books: Book[]; onBook: (book: Book) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(144px,1fr))]">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={onBook} />
      ))}
    </div>
  );
}

export default function AuthorBooks() {
  const { authorId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authors: authorRecords, loading: authorsLoading, error: authorsError } = useAuthorsContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(true);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [readingLogsLoading, setReadingLogsLoading] = useState(true);
  const [readingLogsError, setReadingLogsError] = useState<string | null>(null);

  const display = normalizeDisplay(searchParams.get("display"));
  const timelineSort = normalizeTimelineSort(searchParams.get("sort"));

  useEffect(() => {
    let ignore = false;

    fetchAllBookJournalEntryRecords()
      .then((data) => {
        if (!ignore) setJournalEntries(data);
      })
      .catch((error) => {
        if (!ignore) {
          setJournalEntriesError(error instanceof Error ? error.message : "Failed to load quotes");
        }
      })
      .finally(() => {
        if (!ignore) setJournalEntriesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    fetchReadingLogs()
      .then((data) => {
        if (!ignore) setReadingLogs(data);
      })
      .catch((error) => {
        if (!ignore) {
          setReadingLogsError(error instanceof Error ? error.message : "Failed to load reading history");
        }
      })
      .finally(() => {
        if (!ignore) setReadingLogsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const authorSummaries = useMemo(() => buildAuthorSummaries(authorRecords, books, journalEntries), [authorRecords, books, journalEntries]);
  const author = useMemo(() => findAuthorSummary(authorSummaries, authorId), [authorSummaries, authorId]);
  const latestReadDateByBook = useMemo(() => getReadingLogDateByBook(readingLogs), [readingLogs]);

  const timelineBooks = useMemo(() => {
    if (!author) return [];
    return sortTimelineBooks(author.books, timelineSort, latestReadDateByBook);
  }, [author, latestReadDateByBook, timelineSort]);

  const timelineItems = useMemo<BookTimelineItem[]>(() => {
    return timelineBooks.map((book, index) => {
      const dateValue = getTimelineSortDate(book, timelineSort, latestReadDateByBook);
      const currentKey = formatTimelineGroupKey(dateValue, timelineSort);
      const previousBook = timelineBooks[index - 1];
      const previousValue = previousBook
        ? getTimelineSortDate(previousBook, timelineSort, latestReadDateByBook)
        : null;
      const previousKey = previousBook ? formatTimelineGroupKey(previousValue, timelineSort) : null;
      const nextBook = timelineBooks[index + 1];
      const nextValue = nextBook ? getTimelineSortDate(nextBook, timelineSort, latestReadDateByBook) : null;
      const nextKey = nextBook ? formatTimelineGroupKey(nextValue, timelineSort) : null;
      const isGroupStart = currentKey !== previousKey;

      return {
        book,
        dateLabel: formatTimelineLabel(dateValue, timelineSort),
        subtitle: getSeriesLabel(book, series),
        showDate: isGroupStart,
        showPoint: isGroupStart,
        showDivider: Boolean(nextBook) && currentKey !== nextKey,
      };
    });
  }, [latestReadDateByBook, series, timelineBooks, timelineSort]);

  if (authorsLoading || booksLoading || journalEntriesLoading || seriesLoading || readingLogsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
        <LoadingAuthors />
      </div>
    );
  }

  if (booksError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{booksError}</div>;
  }

  if (authorsError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{authorsError}</div>;
  }

  if (seriesError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{seriesError}</div>;
  }

  if (readingLogsError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{readingLogsError}</div>;
  }

  if (journalEntriesError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{journalEntriesError}</div>;
  }

  if (!author) {
    return (
      <div className="space-y-4">
        <BackButton fallbackTo="/authors" />
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="font-heading text-lg font-medium">Author not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This author was not found in your current library.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <BackButton fallbackTo="/authors" />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{author.name}</p>
            <h1 className="font-heading text-3xl font-medium leading-tight sm:text-4xl">Books</h1>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex rounded-lg border bg-background p-0.5 dark:bg-input/30">
              <Button
                type="button"
                size="icon-sm"
                variant={display === "cards" ? "secondary" : "ghost"}
                aria-label="Cards view"
                aria-pressed={display === "cards"}
                onClick={() =>
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current);
                    if (display === "cards") next.delete("display");
                    else next.set("display", "cards");
                    return next;
                  }, { replace: true })
                }
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant={display === "timeline" ? "secondary" : "ghost"}
                aria-label="Timeline view"
                aria-pressed={display === "timeline"}
                onClick={() =>
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current);
                    if (display === "timeline") next.delete("display");
                    else next.set("display", "timeline");
                    return next;
                  }, { replace: true })
                }
              >
                <Timeline className="h-4 w-4" />
              </Button>
            </div>
            <Select
              value={timelineSort}
              onValueChange={(value) =>
                setSearchParams(
                  (current) => {
                    const next = new URLSearchParams(current);
                    if (value === "publication-date") next.delete("sort");
                    else next.set("sort", value);
                    return next;
                  },
                  { replace: true },
                )
              }
            >
              <SelectTrigger className="w-[14rem] justify-between gap-1.5" aria-label="Sort books">
                <span className="text-muted-foreground">Sort by:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="publication-date">Publication Date</SelectItem>
                <SelectItem value="read-date">Reading Order</SelectItem>
                <SelectItem value="date-added">Date Added</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {display === "timeline" ? (
          timelineBooks.length === 0 ? (
            <EmptyState message="Books by this author will appear here." />
          ) : (
            <BookTimeline items={timelineItems} onBook={(item) => navigate(`/books/${item.id}`)} />
          )
        ) : timelineBooks.length === 0 ? (
          <EmptyState message="Books by this author will appear here." />
        ) : (
          <BooksGrid books={timelineBooks} onBook={(book) => navigate(`/books/${book.id}`)} />
        )}
      </section>
    </div>
  );
}
