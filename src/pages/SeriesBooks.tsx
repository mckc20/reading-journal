import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, Grid2X2, Timeline } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookCard from "@/components/BookCard";
import BookTimeline, { type BookTimelineItem } from "@/components/BookTimeline";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { fetchReadingLogs } from "@/lib/books";
import { parseLocalDateOnly } from "@/lib/bookAnalytics";
import {
  filterSeriesLogs,
  getJourneyBookDates,
  getJourneyDurationDays,
  sortSeriesBooks,
} from "@/lib/seriesDetails";
import type { Book, ReadingLog } from "@/types";

type SeriesBooksDisplay = "cards" | "timeline";
type SeriesTimelineSort = "publication-date" | "reading-order" | "chronological-order";

const STORAGE_KEY = "reading-journal:series-books-display";

function normalizeDisplay(value: string | null): SeriesBooksDisplay | null {
  if (value === "cards" || value === "timeline") return value;
  return null;
}

function normalizeTimelineSort(value: string | null): SeriesTimelineSort {
  if (value === "publication-date" || value === "reading-order" || value === "chronological-order") return value;
  return "publication-date";
}

function getStoredDisplay(): SeriesBooksDisplay {
  if (typeof window === "undefined") return "cards";
  return normalizeDisplay(window.localStorage.getItem(STORAGE_KEY)) ?? "cards";
}

function formatPublicationDate(value?: string | null): { year: string; month: string } {
  if (!value) return { year: "Unknown", month: "" };
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return { year: "Unknown", month: "" };
  return {
    year: date.getFullYear().toString(),
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
  };
}

function formatVolumeNumber(book: Book, index: number): string {
  return String(book.volume_number ?? index + 1);
}

function formatDate(value: string | null): string {
  const date = parseLocalDateOnly(value ?? undefined);
  if (!date) return "--";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDays(value: number | null): string {
  if (value === null) return "--";
  return `${value} day${value === 1 ? "" : "s"}`;
}

function compareBySeriesOrder(orderedBooks: Book[], left: Book, right: Book): number {
  return orderedBooks.findIndex((book) => book.id === left.id) - orderedBooks.findIndex((book) => book.id === right.id);
}

function getDateTime(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const time = new Date(value.includes("T") ? value : `${value}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function getReadingOrderTime(book: Book, logs: ReadingLog[]): number {
  const dates = getJourneyBookDates(book, logs);
  return getDateTime(dates.started ?? dates.finished, Number.NEGATIVE_INFINITY);
}

function sortTimelineBooks(books: Book[], sort: SeriesTimelineSort, logs: ReadingLog[]): Book[] {
  const orderedBooks = sortSeriesBooks(books);
  if (sort === "chronological-order") return orderedBooks;

  return [...books].sort((a, b) => {
    if (sort === "reading-order") {
      const aIsCurrent = a.status === "Reading" || a.status === "Paused";
      const bIsCurrent = b.status === "Reading" || b.status === "Paused";
      if (aIsCurrent !== bIsCurrent) return aIsCurrent ? -1 : 1;

      return getReadingOrderTime(b, logs) - getReadingOrderTime(a, logs)
        || compareBySeriesOrder(orderedBooks, a, b);
    }

    const aTime = getDateTime(a.publication_date, Number.POSITIVE_INFINITY);
    const bTime = getDateTime(b.publication_date, Number.POSITIVE_INFINITY);
    return aTime - bTime || a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
  });
}

function getTimelineDateLabel(
  book: Book,
  index: number,
  sort: SeriesTimelineSort,
  logs: ReadingLog[],
): { year: string; month: string } {
  if (sort === "chronological-order") {
    return { month: formatVolumeNumber(book, index), year: "VOL" };
  }

  if (sort !== "reading-order") return formatPublicationDate(book.publication_date);

  const dates = getJourneyBookDates(book, logs);
  return formatPublicationDate(dates.started ?? dates.finished);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function SeriesBooks() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [readingLogsLoading, setReadingLogsLoading] = useState(true);
  const [readingLogsError, setReadingLogsError] = useState<string | null>(null);

  const urlDisplay = normalizeDisplay(searchParams.get("display"));
  const display = urlDisplay ?? getStoredDisplay();
  const timelineSort = normalizeTimelineSort(searchParams.get("sort"));
  const seriesRecord = series.find((item) => item.id === seriesId) ?? null;
  const seriesBooks = useMemo(
    () => sortSeriesBooks(books.filter((book) => book.series_id === seriesId)),
    [books, seriesId],
  );
  const seriesLogs = useMemo(() => filterSeriesLogs(seriesBooks, readingLogs), [readingLogs, seriesBooks]);
  const timelineBooks = useMemo(
    () => sortTimelineBooks(seriesBooks, timelineSort, seriesLogs),
    [seriesBooks, seriesLogs, timelineSort],
  );
  const needsReadingLogs = display === "timeline" || timelineSort === "reading-order";

  useEffect(() => {
    let ignore = false;
    fetchReadingLogs()
      .then((data) => {
        if (!ignore) setReadingLogs(data);
      })
      .catch((error) => {
        if (!ignore) setReadingLogsError(error instanceof Error ? error.message : "Failed to load reading history");
      })
      .finally(() => {
        if (!ignore) setReadingLogsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, display);
  }, [display]);

  function updateDisplay(nextDisplay: SeriesBooksDisplay) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (nextDisplay === "cards") next.delete("display");
        else next.set("display", nextDisplay);
        return next;
      },
      { replace: true },
    );
    window.localStorage.setItem(STORAGE_KEY, nextDisplay);
  }

  const timelineItems = useMemo<BookTimelineItem[]>(
    () =>
      timelineBooks.map((book, index) => {
        const dates = getJourneyBookDates(book, seriesLogs);
        const days = getJourneyDurationDays(book, seriesLogs);
        const sortedSeriesIndex = seriesBooks.findIndex((item) => item.id === book.id);

        return {
          book,
          dateLabel: getTimelineDateLabel(book, sortedSeriesIndex, timelineSort, seriesLogs),
          subtitle: `Book ${book.volume_number ?? sortedSeriesIndex + 1}`,
          showDate: true,
          showPoint: true,
          showDivider: index < timelineBooks.length - 1,
          details: (
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <span>Started: {formatDate(dates.started)}</span>
              <span>Finished: {formatDate(dates.finished)}</span>
              <span>Days spent: {formatDays(days)}</span>
            </div>
          ),
        };
      }),
    [seriesBooks, seriesLogs, timelineBooks, timelineSort],
  );

  if (booksLoading || seriesLoading || (needsReadingLogs && readingLogsLoading)) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  if (booksError || seriesError || (needsReadingLogs && readingLogsError)) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{booksError || seriesError || readingLogsError}</div>;
  }

  if (!seriesRecord) {
    return (
      <div className="space-y-4">
        <BackButton fallbackTo="/library/series" />
        <EmptyState message="This series was not found in your library." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackButton fallbackTo={`/series/${seriesRecord.id}`} />
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <HeadingDescription>{seriesRecord.name}</HeadingDescription>
            <AppHeading level={1}>Books</AppHeading>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex rounded-lg border bg-background p-0.5 dark:bg-input/30">
              <Button
                type="button"
                size="icon-sm"
                variant={display === "cards" ? "secondary" : "ghost"}
                aria-label="Card view"
                aria-pressed={display === "cards"}
                onClick={() => updateDisplay("cards")}
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant={display === "timeline" ? "secondary" : "ghost"}
                aria-label="Timeline view"
                aria-pressed={display === "timeline"}
                onClick={() => updateDisplay("timeline")}
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
                <SelectItem value="reading-order">Reading Order</SelectItem>
                <SelectItem value="chronological-order">Volume Number</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {seriesBooks.length === 0 ? (
          <EmptyState message="Books added to this series will appear here." />
        ) : display === "timeline" ? (
          <BookTimeline items={timelineItems} onBook={(book) => navigate(`/books/${book.id}`)} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(144px,1fr))]">
            {timelineBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={(item) => navigate(`/books/${item.id}`)}
                cornerLabel={
                  timelineSort === "chronological-order"
                    ? formatVolumeNumber(book, seriesBooks.findIndex((item) => item.id === book.id))
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
