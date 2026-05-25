import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, Flag, Star } from "lucide-react";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { parseLocalDateOnly, type CalendarSpan } from "@/lib/bookAnalytics";
import { fetchAllBookNotes } from "@/lib/bookNotes";
import { fetchReadingLogs } from "@/lib/books";
import {
  filterSeriesLogs,
  getAverageSeriesRating,
  getBookProgressPercent,
  getFeaturedNoteCandidates,
  getJourneyBookDates,
  getJourneyDurationDays,
  getLatestSeriesActivity,
  getMostCommonGenre,
  getNextUpBook,
  getSeriesAuthors,
  getSeriesJourneyRecap,
  getSeriesJourneyTransition,
  getSeriesProgress,
  getSeriesStats,
  sortSeriesBooks,
  type SeriesJourneyTransition,
} from "@/lib/seriesDetails";
import { cn, getTodayLocalDate } from "@/lib/utils";
import type { Book, BookNote, ReadingLog } from "@/types";

function bookCountLabel(count: number): string {
  return `${count} book${count === 1 ? "" : "s"}`;
}

function formatAverageRating(value: number | null): string {
  return value === null ? "No rating" : `${value.toFixed(1)} avg rating`;
}

function formatActivityDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDate(value: string | null): string {
  const date = parseLocalDateOnly(value ?? undefined);
  if (!date) return "--";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthYear(value: string | null): string {
  const date = parseLocalDateOnly(value ?? undefined);
  if (!date) return "--";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDaysSpent(days: number | null): string {
  if (days === null) return "--";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function BookThumbnail({ book }: { book: Book }) {
  return (
    <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm">
      {book.cover_url ? (
        <img src={book.cover_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <BookOpen className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  children,
  className = "",
  compact = false,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={`rounded-xl border bg-card ${compact ? "p-4" : "p-5"} ${className}`}>
      {title && <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>}
      <div className={title ? (compact ? "mt-3" : "mt-4") : ""}>{children}</div>
    </section>
  );
}

function formatStatsReadingTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0 && remainingMinutes === 0) return "0h";
  if (hours === 0) return `${remainingMinutes}m`;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatStatsJourneySpan(span: CalendarSpan): string {
  const parts: string[] = [];
  if (span.months > 0) parts.push(`${span.months} mo`);
  if (span.weeks > 0) parts.push(`${span.weeks} wk`);
  if (span.days > 0) parts.push(`${span.days} d`);
  return parts.join(" ") || "0 d";
}

function StatsOverviewCard({
  label,
  value,
  unavailableLabel,
}: {
  label: string;
  value: ReactNode | null;
  unavailableLabel?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-semibold">{value ?? "--"}</p>
      {value === null && unavailableLabel && (
        <p className="mt-2 text-xs text-muted-foreground">{unavailableLabel}</p>
      )}
    </div>
  );
}

function WinnerStatsCard({
  title,
  books,
  detail,
  emptyLabel,
}: {
  title: string;
  books: Book[];
  detail: string | null;
  emptyLabel: string;
}) {
  return (
    <SummaryCard title={title} compact>
      {books.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {books.map((book) => (
            <SmallBookRow key={book.id} book={book} metadata={detail} />
          ))}
        </div>
      )}
    </SummaryCard>
  );
}

function StatsBarChart({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<{ book: Book; value: number; formattedValue: string }>;
  emptyLabel: string;
}) {
  const maximumValue = Math.max(...rows.map((row) => row.value), 0);

  return (
    <SummaryCard title={title} compact>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.book.id} className="grid gap-2 sm:grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)_7rem] sm:items-center">
              <Link to={`/books/${row.book.id}`} className="truncate text-sm font-medium hover:underline">
                {row.book.title}
              </Link>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-zinc-800"
                  style={{ width: `${maximumValue > 0 ? (row.value / maximumValue) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm tabular-nums text-muted-foreground sm:text-right">
                {row.formattedValue}
              </p>
            </div>
          ))}
        </div>
      )}
    </SummaryCard>
  );
}

function SmallBookRow({
  book,
  prefix,
  metadata,
}: {
  book: Book;
  prefix?: string;
  metadata?: string | null;
}) {
  return (
    <Link
      to={`/books/${book.id}`}
      className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted/50"
    >
      <BookThumbnail book={book} />
      <div className="min-w-0">
        {prefix && <p className="text-xs text-muted-foreground">{prefix}</p>}
        <p className="line-clamp-2 text-sm font-medium">{book.title}</p>
        {metadata ? (
          <p className="text-xs font-medium text-muted-foreground">{metadata}</p>
        ) : book.volume_number != null && (
          <p className="text-xs text-muted-foreground">Volume {book.volume_number}</p>
        )}
      </div>
    </Link>
  );
}

function SeriesOverviewBookTile({ book, index }: { book: Book; index: number }) {
  const isFinished = book.status === "Finished";
  const isReading = book.status === "Reading";
  const sequenceNumber = book.volume_number ?? index + 1;
  const percent = getBookProgressPercent(book);
  const statusLabel = isFinished
    ? "Completed"
    : isReading
      ? "Currently Reading"
      : book.status === "DNF"
        ? "DNF"
        : "Unread";

  return (
    <Link
      to={`/books/${book.id}`}
      className={cn(
        "group relative flex min-w-0 flex-col items-center rounded-xl border bg-background px-3 pb-4 pt-3 text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.035)] transition-shadow hover:shadow-[0_2px_6px_rgb(0_0_0/0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isReading && "border-foreground ring-1 ring-foreground",
      )}
      aria-label={`Open ${book.title}`}
    >
      <span
        className={cn(
          "absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold shadow-sm",
          isFinished && "border-zinc-400 bg-zinc-400 text-white",
          isReading && "border-foreground bg-foreground text-background",
          !isFinished && !isReading && "border-border bg-background text-muted-foreground",
        )}
      >
        {sequenceNumber}
      </span>

      <div
        className="h-[190px] w-[126px] overflow-hidden rounded-md bg-muted shadow-sm sm:h-[210px] sm:w-[140px]"
      >
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-center text-sm font-semibold leading-snug">
        {book.title}
      </p>

      <div
        className="mt-0.5 flex items-center gap-0.5 text-muted-foreground"
        aria-label={book.rating ? `${book.rating} out of 5 stars` : "Not rated"}
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <Star
            key={rating}
            className={cn(
              "h-4 w-4",
              book.rating && rating <= book.rating
                ? "fill-foreground text-foreground"
                : "fill-muted text-muted-foreground/45",
            )}
          />
        ))}
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
        {isFinished ? (
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-500 bg-zinc-500 text-white"
            aria-hidden
          >
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </span>
        ) : (
          <span
            className={cn(
              "h-3 w-3 rounded-full border",
              isReading ? "border-foreground bg-foreground" : "border-muted-foreground bg-background",
            )}
            aria-hidden
          />
        )}
        {statusLabel}
      </p>

      {isReading && percent !== null && (
        <div className="mt-3 flex w-full items-center gap-2">
          <Progress value={percent} className="h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-foreground" />
          <span className="text-xs text-muted-foreground">{percent}%</span>
        </div>
      )}
    </Link>
  );
}

function RatingStars({ rating }: { rating?: number | null }) {
  return (
    <div className="flex items-center gap-1" aria-label={rating ? `${rating} out of 5 stars` : "Not rated"}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            "h-4 w-4",
            rating && value <= rating
              ? "fill-foreground text-foreground"
              : "fill-background text-muted-foreground/50",
          )}
        />
      ))}
    </div>
  );
}

function JourneyFeaturedNote({ bookId, notes }: { bookId: string; notes: BookNote[] }) {
  const maximumVisibleLines = 4;
  const candidates = useMemo(() => getFeaturedNoteCandidates(notes), [notes]);
  const containerRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef(new Map<string, HTMLParagraphElement>());
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const selectNote = () => {
      const nextNote = candidates.find((note) => {
        const element = noteRefs.current.get(note.id);
        if (!element) return false;
        const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
        return element.scrollHeight <= lineHeight * maximumVisibleLines + 1;
      });
      setSelectedNoteId(nextNote?.id ?? null);
    };

    selectNote();
    const observer = new ResizeObserver(selectNote);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [candidates]);

  const selectedNote = candidates.find((note) => note.id === selectedNoteId) ?? null;

  return (
    <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col">
      <div className="pointer-events-none invisible absolute inset-x-0 top-0" aria-hidden>
        {candidates.map((note) => (
          <p
            key={note.id}
            ref={(element) => {
              if (element) noteRefs.current.set(note.id, element);
              else noteRefs.current.delete(note.id);
            }}
            className="absolute inset-x-0 whitespace-pre-line font-serif text-sm italic leading-6"
          >
            &ldquo;{note.content.trim()}&rdquo;
          </p>
        ))}
      </div>
      {selectedNote && (
        <p className="line-clamp-4 whitespace-pre-line font-serif text-sm italic leading-6 text-foreground">
          &ldquo;{selectedNote.content.trim()}&rdquo;
        </p>
      )}
      {notes.length > 0 && (
        <Link
          to={`/books/${bookId}?tab=notes`}
          className="mt-auto self-end pt-4 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          All Notes -&gt;
        </Link>
      )}
    </div>
  );
}

function TimelineMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function SeriesJourneyTransitionRow({
  transition,
  connectsToCurrent,
}: {
  transition: SeriesJourneyTransition;
  connectsToCurrent: boolean;
}) {
  return (
    <div className="relative grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <span
        className={cn(
          "absolute bottom-0 left-10 top-0 w-px sm:left-[3.25rem]",
          connectsToCurrent ? "bg-foreground" : "bg-border",
        )}
        aria-hidden
      />
      <div />
      <div className="flex max-w-md items-center gap-4 rounded-lg bg-muted/45 px-5 py-3 text-sm">
        <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-medium">
          {transition.kind === "break"
            ? `Took a ${transition.days} day break`
            : "Started right after previous book"}
        </span>
        <span className="text-muted-foreground">
          {transition.kind === "break"
            ? `${formatDate(transition.finished)} - ${formatDate(transition.started)}`
            : formatDate(transition.started)}
        </span>
      </div>
    </div>
  );
}

function SeriesJourneyItem({
  book,
  logs,
  notes,
  isFirst,
  isLast,
  nextBookIsReading,
  transition,
}: {
  book: Book;
  logs: ReadingLog[];
  notes: BookNote[];
  isFirst: boolean;
  isLast: boolean;
  nextBookIsReading: boolean;
  transition: SeriesJourneyTransition | null;
}) {
  const isFinished = book.status === "Finished";
  const isReading = book.status === "Reading";
  const percent = getBookProgressPercent(book);
  const dates = getJourneyBookDates(book, logs);
  const durationDays = getJourneyDurationDays(book, logs);
  const volumeLabel =
    book.volume_number != null ? `Volume ${book.volume_number}` : "Volume not set";
  const pageProgress =
    book.total_pages && book.current_page != null
      ? `${book.current_page.toLocaleString()} / ${book.total_pages.toLocaleString()} pages`
      : null;

  return (
    <div>
      <div className="relative grid grid-cols-[5rem_minmax(0,1fr)] gap-4 pb-6 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
        <div className="relative flex flex-col items-center">
          {!isFirst && (
            <span
              className={cn(
                "absolute top-0 h-7 w-px",
                isReading ? "bg-foreground" : "bg-border",
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              "relative z-10 mt-7 flex h-7 w-7 items-center justify-center rounded-full border bg-background",
              isFinished && "border-zinc-400 bg-zinc-400 text-background",
              isReading && "border-foreground bg-foreground text-background",
              !isFinished && !isReading && "border-muted-foreground/70 text-muted-foreground",
            )}
            aria-hidden
          >
            {isFinished ? (
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            ) : null}
          </span>
          <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {isFinished
              ? formatDate(dates.finished)
              : isReading
                ? formatDate(dates.started)
                : book.status === "Up Next"
                  ? "Up next"
                  : "Future"}
          </p>
          {!isLast && (
            <span
              className={cn(
                "-mb-6 mt-4 min-h-4 w-px flex-1",
                isReading || nextBookIsReading ? "bg-foreground" : "bg-border",
              )}
              aria-hidden
            />
          )}
        </div>

        <article
          className={cn(
            "grid min-w-0 gap-5 rounded-xl border bg-card p-4 shadow-[0_1px_3px_rgb(0_0_0/0.04)] sm:grid-cols-[7rem_minmax(13rem,1fr)] lg:grid-cols-[7rem_minmax(17rem,1fr)_minmax(13rem,17rem)]",
            isReading && "border-foreground ring-1 ring-foreground",
          )}
        >
          <Link
            to={`/books/${book.id}`}
            className="h-[168px] w-28 overflow-hidden rounded-lg bg-muted shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open ${book.title}`}
          >
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
          </Link>

          <div className="min-w-0 space-y-6 py-1">
            <div>
              <Link
                to={`/books/${book.id}`}
                className="line-clamp-2 font-heading text-xl font-semibold hover:underline"
              >
                {book.title}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{volumeLabel}</p>
            </div>

            {isFinished && (
              <div className="grid gap-4 sm:grid-cols-3">
                <TimelineMetric label="Started" value={formatDate(dates.started)} />
                <TimelineMetric label="Finished" value={formatDate(dates.finished)} />
                <TimelineMetric
                  label="Time Spent"
                  value={formatDaysSpent(durationDays)}
                />
              </div>
            )}

            {isReading && (
              <div className="grid gap-4 sm:grid-cols-3">
                <TimelineMetric label="Started" value={formatDate(dates.started)} />
                <TimelineMetric
                  label="Progress"
                  value={
                    percent !== null ? (
                      <div className="space-y-2">
                        <span>{percent}%</span>
                        <Progress
                          value={percent}
                          className="h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-foreground"
                        />
                        {pageProgress && (
                          <p className="text-xs font-normal text-muted-foreground">{pageProgress}</p>
                        )}
                      </div>
                    ) : (
                      "--"
                    )
                  }
                />
                <TimelineMetric label="Time Spent" value={formatDaysSpent(durationDays)} />
              </div>
            )}

            {!isFinished && !isReading && (
              <p className="text-sm text-muted-foreground">Not started yet</p>
            )}
          </div>

          {(isFinished || isReading) && (
            <div className="flex min-h-full flex-col gap-5 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-2">
              <RatingStars rating={book.rating} />
              <JourneyFeaturedNote bookId={book.id} notes={notes} />
            </div>
          )}
        </article>
      </div>
      {transition && (
        <SeriesJourneyTransitionRow
          transition={transition}
          connectsToCurrent={nextBookIsReading}
        />
      )}
    </div>
  );
}

function PageLoading() {
  return (
    <div className="space-y-6">
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function SeriesDetails() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const { books, loading: booksLoading, error: booksError, updateBook } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [notes, setNotes] = useState<BookNote[]>([]);

  const seriesRecord = series.find((item) => item.id === seriesId) ?? null;
  const seriesBooks = useMemo(
    () => sortSeriesBooks(books.filter((book) => book.series_id === seriesId)),
    [books, seriesId],
  );

  const loadLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      setLogs(await fetchReadingLogs());
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : "Failed to load reading activity");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await fetchAllBookNotes());
    } catch {
      setNotes([]);
    }
  }, []);

  useEffect(() => {
    if (!seriesRecord) {
      if (!seriesLoading) setLogsLoading(false);
      return;
    }
    if (seriesBooks.length === 0) {
      setLogs([]);
      setNotes([]);
      setLogsError(null);
      setLogsLoading(false);
      return;
    }
    void loadLogs();
    void loadNotes();
  }, [loadLogs, loadNotes, seriesBooks.length, seriesLoading, seriesRecord]);

  const seriesLogs = useMemo(() => filterSeriesLogs(seriesBooks, logs), [logs, seriesBooks]);
  const seriesBookIds = useMemo(() => new Set(seriesBooks.map((book) => book.id)), [seriesBooks]);
  const notesByBook = useMemo(() => {
    const map = new Map<string, BookNote[]>();
    notes
      .filter((note) => seriesBookIds.has(note.book_id))
      .forEach((note) => {
        map.set(note.book_id, [...(map.get(note.book_id) ?? []), note]);
      });
    return map;
  }, [notes, seriesBookIds]);
  const progress = useMemo(() => getSeriesProgress(seriesBooks), [seriesBooks]);
  const authors = useMemo(() => getSeriesAuthors(seriesBooks), [seriesBooks]);
  const primaryGenre = useMemo(() => getMostCommonGenre(seriesBooks), [seriesBooks]);
  const averageRating = useMemo(() => getAverageSeriesRating(seriesBooks), [seriesBooks]);
  const readingBooks = useMemo(
    () => seriesBooks.filter((book) => book.status === "Reading"),
    [seriesBooks],
  );
  const nextUp = useMemo(() => getNextUpBook(seriesBooks), [seriesBooks]);
  const latestActivity = useMemo(
    () => getLatestSeriesActivity(seriesBooks, seriesLogs),
    [seriesBooks, seriesLogs],
  );
  const journeyRecap = useMemo(
    () => getSeriesJourneyRecap(seriesBooks, seriesLogs),
    [seriesBooks, seriesLogs],
  );
  const stats = useMemo(
    () => getSeriesStats(seriesBooks, seriesLogs, notes),
    [notes, seriesBooks, seriesLogs],
  );

  async function saveProgress(book: Book, newPage: number) {
    const shouldFinish = Boolean(book.total_pages && newPage >= book.total_pages);

    await updateBook(book.id, {
      current_page: newPage,
      ...(shouldFinish
        ? {
            status: "Finished",
            ...(book.date_finished ? {} : { date_finished: getTodayLocalDate() }),
          }
        : {}),
    });
    await loadLogs();
  }

  if (booksLoading || seriesLoading) return <PageLoading />;

  if (booksError || seriesError) {
    return <p className="text-sm text-destructive">{booksError || seriesError}</p>;
  }

  if (!seriesRecord) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="font-heading text-xl font-medium">Series not found</h1>
        <p className="text-sm text-muted-foreground">
          This series may have been deleted or you may not have access.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/series">Back to Series</Link>
        </Button>
      </div>
    );
  }

  const headerAuthors = authors.length > 0 ? authors.join(", ") : "Unknown author";
  const allFinished =
    seriesBooks.length > 0 && seriesBooks.every((book) => book.status === "Finished");

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="px-2" asChild>
        <Link to="/series">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Series
        </Link>
      </Button>

      <header className="relative flex min-h-64 items-end overflow-hidden rounded-2xl border bg-muted">
        <div
          className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-800 to-stone-700"
          aria-label="Series banner placeholder"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="relative space-y-3 p-6 text-white sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
            Series
          </p>
          <h1 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl">
            {seriesRecord.name}
          </h1>
          <p className="text-base text-white/85">by {headerAuthors}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
            <span>{bookCountLabel(seriesBooks.length)}</span>
            <span aria-hidden>·</span>
            <span>{primaryGenre ?? "No genre"}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-current" />
              {formatAverageRating(averageRating)}
            </span>
          </div>
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList variant="line" className="w-full justify-start gap-8 rounded-none border-b pb-0">
          <TabsTrigger value="overview" className="min-w-20 px-0">Overview</TabsTrigger>
          <TabsTrigger value="journey" className="min-w-20 px-0">Journey</TabsTrigger>
          <TabsTrigger value="stats" className="min-w-20 px-0">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {seriesBooks.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Books added to this series will appear here.
            </p>
          ) : (
            <div className="space-y-8">
              <div className="grid gap-4 lg:grid-cols-3">
                <SummaryCard title="Overall Progress">
              {progress.isAvailable ? (
                <>
                  <p className="font-heading text-5xl font-semibold">{progress.percentage}%</p>
                  <Progress value={progress.percentage ?? 0} className="mt-4 h-2" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {progress.finishedBooks} of {seriesBooks.length} books read
                  </p>
                </>
              ) : (
                <>
                  <p className="font-heading text-3xl font-semibold">--</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add total pages to every volume to calculate series progress.
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {progress.finishedBooks} of {seriesBooks.length} books read
                  </p>
                </>
              )}
                </SummaryCard>

                <SummaryCard title="Currently Reading">
              {readingBooks.length > 0 ? (
                <div className="space-y-4">
                  {readingBooks.map((book) => {
                    const percent = getBookProgressPercent(book);
                    return (
                      <div key={book.id} className="space-y-2">
                        <SmallBookRow book={book} />
                        {percent !== null && (
                          <div className="space-y-1">
                            <Progress value={percent} className="h-1.5" />
                            <p className="text-xs text-muted-foreground">{percent}% read</p>
                          </div>
                        )}
                        <ReadingProgressDialog
                          book={book}
                          onProgressSaved={(newPage) => saveProgress(book, newPage)}
                          trigger={
                            <Button type="button" size="sm" variant="outline">
                              Update Progress
                            </Button>
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No book currently reading</p>
              )}
                </SummaryCard>

                <SummaryCard>
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Next up
                  </p>
                  {nextUp ? (
                    <SmallBookRow book={nextUp} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {allFinished ? "Series complete" : "No next book available"}
                    </p>
                  )}
                </div>
                <div className="border-t pt-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Latest read
                  </p>
                  {logsLoading ? (
                    <p className="mt-2 text-sm text-muted-foreground">Loading activity...</p>
                  ) : logsError ? (
                    <p className="mt-2 text-sm text-muted-foreground">Unavailable</p>
                  ) : latestActivity ? (
                    <p className="mt-2 text-sm">
                      {latestActivity.book.title}
                      <span className="block text-xs text-muted-foreground">
                        {formatActivityDate(latestActivity.log.logged_at)}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No reading activity yet</p>
                  )}
                </div>
              </div>
                </SummaryCard>
              </div>

              <section className="space-y-4">
                <h2 className="font-heading text-xl font-medium">Books in this series</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {seriesBooks.map((book, index) => (
                    <SeriesOverviewBookTile key={book.id} book={book} index={index} />
                  ))}
                </div>
              </section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="journey" className="space-y-6">
          <h2 className="font-heading text-xl font-medium">Reading Journey</h2>
          {seriesBooks.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Books added to this series will appear here.
            </p>
          ) : (
            <div className="space-y-8">
              <section className="grid gap-5 rounded-xl border bg-card p-5 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Started this series</p>
                  <p className="mt-2 text-lg font-semibold">{formatMonthYear(journeyRecap.started)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Journey Length</p>
                  <p className="mt-2 text-lg font-semibold">
                    {stats.overview.journeySpan
                      ? formatStatsJourneySpan(stats.overview.journeySpan)
                      : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Completed</p>
                  <p className="mt-2 text-lg font-semibold">
                    {journeyRecap.finishedBooks} book{journeyRecap.finishedBooks === 1 ? "" : "s"}
                    {journeyRecap.completedMonths !== null && (
                      <span className="block text-sm font-normal text-muted-foreground">
                        over{" "}
                        {journeyRecap.completedMonths === 0
                          ? "less than 1 month"
                          : `${journeyRecap.completedMonths} month${journeyRecap.completedMonths === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Favorite book</p>
                  <p className="mt-2 line-clamp-2 text-lg font-semibold">
                    {journeyRecap.favoriteBook?.title ?? "No favorite selected"}
                  </p>
                </div>
              </section>

              <div>
                {seriesBooks.map((book, index) => {
                  const nextBook = seriesBooks[index + 1];
                  const transition = nextBook
                    ? getSeriesJourneyTransition(book, nextBook, seriesLogs)
                    : null;

                  return (
                    <SeriesJourneyItem
                      key={book.id}
                      book={book}
                      logs={seriesLogs}
                      notes={notesByBook.get(book.id) ?? []}
                      isFirst={index === 0}
                      isLast={index === seriesBooks.length - 1}
                      nextBookIsReading={nextBook?.status === "Reading"}
                      transition={transition}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="space-y-7">
          <h2 className="font-heading text-xl font-medium">Series Stats</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatsOverviewCard
              label="Books Completed"
              value={`${stats.overview.finishedBooks}/${stats.overview.totalBooks}`}
            />
            <StatsOverviewCard
              label="Pages Read"
              value={
                stats.overview.pagesRead === null
                  ? null
                  : stats.overview.pagesRead.toLocaleString()
              }
              unavailableLabel="Page progress is incomplete."
            />
            <StatsOverviewCard
              label="Hours Read"
              value={
                logsLoading
                  ? "..."
                  : logsError
                    ? null
                    : formatStatsReadingTime(stats.overview.readingMinutes)
              }
              unavailableLabel="Reading logs are unavailable."
            />
            <StatsOverviewCard
              label="Days Read"
              value={
                stats.overview.journeyDays !== null
                  ? formatDaysSpent(stats.overview.journeyDays)
                  : null
              }
              unavailableLabel="Reading dates are incomplete."
            />
            <StatsOverviewCard
              label="Average Days per Book"
              value={
                stats.averageDaysPerBook === null
                  ? null
                  : `${stats.averageDaysPerBook.toFixed(1)} days`
              }
              unavailableLabel="No completed books with dates."
            />
          </div>

          <section className="space-y-4">
            <h3 className="font-heading text-lg font-medium">Detailed Statistics</h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <WinnerStatsCard
                title="Fastest read"
                books={stats.fastestRead?.books ?? []}
                detail={stats.fastestRead ? formatDaysSpent(stats.fastestRead.value) : null}
                emptyLabel="No completed books with dates"
              />
              <WinnerStatsCard
                title="Slowest read"
                books={stats.slowestRead?.books ?? []}
                detail={stats.slowestRead ? formatDaysSpent(stats.slowestRead.value) : null}
                emptyLabel="No completed books with dates"
              />
              <WinnerStatsCard
                title="Longest book"
                books={stats.longestBook?.books ?? []}
                detail={stats.longestBook ? `${stats.longestBook.value.toLocaleString()} pages` : null}
                emptyLabel="No page totals yet"
              />
              <WinnerStatsCard
                title="Shortest book"
                books={stats.shortestBook?.books ?? []}
                detail={stats.shortestBook ? `${stats.shortestBook.value.toLocaleString()} pages` : null}
                emptyLabel="No page totals yet"
              />
              <WinnerStatsCard
                title="Most annotated book"
                books={stats.mostAnnotated?.books ?? []}
                detail={
                  stats.mostAnnotated
                    ? `${stats.mostAnnotated.value} note${stats.mostAnnotated.value === 1 ? "" : "s"}`
                    : null
                }
                emptyLabel="No notes yet"
              />
              <WinnerStatsCard
                title="Most highlighted book"
                books={stats.mostHighlighted?.books ?? []}
                detail={
                  stats.mostHighlighted
                    ? `${stats.mostHighlighted.value} highlight${stats.mostHighlighted.value === 1 ? "" : "s"}`
                    : null
                }
                emptyLabel="No highlights yet"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="font-heading text-lg font-medium">Reading Pace</h3>
            <div className="grid gap-4 xl:grid-cols-2">
              <StatsBarChart
                title="Reading Duration by Book"
                rows={stats.durationChart.map((row) => ({
                  book: row.book,
                  value: row.days,
                  formattedValue: formatDaysSpent(row.days),
                }))}
                emptyLabel="No completed books with start and finish dates yet."
              />
              <StatsBarChart
                title="Reading Pace by Book"
                rows={stats.paceChart.map((row) => ({
                  book: row.book,
                  value: row.pagesPerDay,
                  formattedValue: `${row.pagesPerDay.toFixed(1)} pages/day`,
                }))}
                emptyLabel="Add completed-book dates and page totals to compare reading pace."
              />
            </div>
          </section>

          {logsError && (
            <p className="text-sm text-muted-foreground">
              Reading activity could not be loaded, so logged hours and date fallbacks may be unavailable.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
