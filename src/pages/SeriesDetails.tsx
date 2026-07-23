import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { BookOpen, CalendarDays, ChevronRight, Gauge, Heart, ImagePlus, Loader2, PauseCircle, Route, Star, Trash2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookCard from "@/components/BookCard";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import JournalTimeline from "@/components/JournalTimeline";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { SeriesAnalyticsOverview, SeriesAnalyticsPaceChart } from "@/components/series/SeriesAnalyticsSections";
import SeriesBooksEditor, {
  buildEditableSeriesBooks,
  parseVolumeInput,
  type EditableSeriesBook,
} from "@/components/series/SeriesBooksEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { parseLocalDateOnly } from "@/lib/bookAnalytics";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import { deleteSeriesBanner, fetchReadingLogs, uploadSeriesBanner } from "@/lib/books";
import { buildSeriesAttachment } from "@/lib/chatAttachments";
import {
  filterSeriesLogs,
  estimateSeriesCompletionDate,
  getAverageSeriesRating,
  getBookProgressPercent,
  getCurrentSeriesBook,
  getDerivedSeriesStatus,
  getJourneyBookDates,
  getSeriesAuthors,
  getSeriesGenres,
  getSeriesJourneyRecap,
  getSeriesProgress,
  getSeriesStats,
  sortSeriesBooks,
} from "@/lib/seriesDetails";
import {
  fetchSeriesJournalEntryRecords,
  sortSeriesJournalEntryRecords,
} from "@/lib/seriesJournal";
import { seriesJournalToJournalEntries, sortJournalEntries } from "@/lib/journal";
import { bookHasGenreName, getMostPopularMatchingGenre } from "@/lib/recommendations";
import { cn, getTodayLocalDate } from "@/lib/utils";
import type { Book, BookJournalEntryRecord, ReadingLog, Series, SeriesJournalEntryRecord } from "@/types";

function bookCountLabel(count: number): string {
  return `${count} book${count === 1 ? "" : "s"}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
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

function formatJourneyLength(
  value: { months: number; weeks: number; days: number } | null,
): string {
  if (!value) return "--";
  const parts = [
    value.months > 0 ? `${value.months} mo` : null,
    value.weeks > 0 ? `${value.weeks} wk` : null,
    value.days > 0 ? `${value.days} d` : null,
  ].filter(Boolean);
  return parts.join(" ") || "0 d";
}

function getSeriesCompletionDates(books: Book[], logs: ReadingLog[]): { started: string | null; finished: string | null } {
  const dates = sortSeriesBooks(books).map((book) => getJourneyBookDates(book, logs));
  const finishedDates = dates.flatMap((date) => (date.finished ? [date.finished] : [])).sort();
  return {
    started: dates.flatMap((date) => (date.started ? [date.started] : [])).sort()[0] ?? null,
    finished: finishedDates[finishedDates.length - 1] ?? null,
  };
}

function formatPagesRead(readPages: number | null, totalPages: number | null): string {
  if (readPages === null || totalPages === null) return "--";
  return `${readPages.toLocaleString()} / ~${totalPages.toLocaleString()}`;
}

function formatReadingPace(books: Book[], logs: ReadingLog[]): string {
  const activeBook = getCurrentSeriesBook(books);
  if (!activeBook) return "--";
  const activeLogs = logs
    .filter((log) => log.book_id === activeBook.id && log.current_page > 0)
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
  if (activeLogs.length < 2) return "--";
  const first = activeLogs[0];
  const last = activeLogs[activeLogs.length - 1];
  const days = Math.max(
    1,
    Math.round((new Date(last.logged_at).getTime() - new Date(first.logged_at).getTime()) / (24 * 60 * 60 * 1000)),
  );
  const pageDelta = last.current_page - first.current_page;
  if (pageDelta <= 0) return "--";
  return `~${Math.round(pageDelta / days)} pages / day`;
}

function BookThumbnail({ book }: { book: Book }) {
  const isPaused = book.status === "Paused";
  return (
    <div
      className={cn(
        "relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm",
        isPaused && "opacity-70",
      )}
    >
      {book.cover_url ? (
        <img
          src={book.cover_url}
          alt=""
          className={cn("h-full w-full object-cover", isPaused && "grayscale")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <BookOpen className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
          <PauseCircle className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-heading text-2xl font-medium leading-snug">{title}</h2>
      {action}
    </div>
  );
}

function ViewMoreLink({ to, label = "View More" }: { to: string; label?: string }) {
  return (
    <Button asChild variant="link" className="px-0 text-primary">
      <Link to={to}>
        {label}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-background/55 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function SeriesJournalSection({
  series,
}: {
  series: Series;
}) {
  const [seriesJournal, setSeriesJournalEntryRecords] = useState<SeriesJournalEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const journalEntries = useMemo(
    () => sortJournalEntries(seriesJournalToJournalEntries(seriesJournal)).slice(0, 3),
    [seriesJournal],
  );

  const loadSeriesJournalEntryRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSeriesJournalEntryRecords(await fetchSeriesJournalEntryRecords(series.id));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load series journal entries"));
    } finally {
      setLoading(false);
    }
  }, [series.id]);

  useEffect(() => {
    void loadSeriesJournalEntryRecords();
  }, [loadSeriesJournalEntryRecords]);

  return (
    <section className="space-y-4">
      <SectionHeader
        title={<span className="font-serif italic">Journal</span>}
        action={
          <Button asChild variant="link" className="px-0 text-primary">
            <Link to={`/series/${series.id}/journal`}>
              Open journal
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        journalEntries.length === 0 ? (
          <EmptySection message="Series journal entries will appear here." />
        ) : (
          <JournalTimeline
            entries={journalEntries}
            layout="cards"
            previewMode={{
              getEntryHref: (entry) => `/series/${series.id}/journal?entry=${encodeURIComponent(entry.sourceId)}`,
            }}
            emptyMessage="Series journal entries will appear here."
            onEntryUpdated={(entry) => {
              if (entry.source === "series_note") {
                setSeriesJournalEntryRecords((current) => sortSeriesJournalEntryRecords([entry.seriesJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
              }
            }}
            onEntryDeleted={(entry) => {
              if (entry.source === "series_note") setSeriesJournalEntryRecords((current) => current.filter((note) => note.id !== entry.sourceId));
            }}
          />
        )
      )}
    </section>
  );
}

function CircularSeriesProgress({ value }: { value: number | null }) {
  const percentage = value ?? 0;
  const background = `conic-gradient(var(--primary) ${percentage * 3.6}deg, var(--muted) 0deg)`;

  return (
    <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full p-3" style={{ background }}>
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-card text-center">
        <span className="font-heading text-3xl font-semibold">{value === null ? "--" : `${value}%`}</span>
        <span className="text-xs text-muted-foreground">Complete</span>
      </div>
    </div>
  );
}

function ProgressStatRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-3 last:border-0">
      <div className="text-primary">{icon}</div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function FeaturedBookProgress({ book, showProgress = true }: { book: Book | null; showProgress?: boolean }) {
  const percent = book ? getBookProgressPercent(book) : null;

  if (!book) {
    return <p className="text-sm text-muted-foreground">No book available</p>;
  }

  return (
    <Link to={`/books/${book.id}`} className="flex min-w-0 gap-3 rounded-lg transition-colors hover:text-muted-foreground">
      <BookThumbnail book={book} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold">{book.title}</p>
        {book.volume_number != null && <p className="text-xs text-muted-foreground">Volume {book.volume_number}</p>}
        {showProgress && (
          <>
            <p className="mt-1 text-xs text-muted-foreground">{percent === null ? "--" : `${percent}% complete`}</p>
            {percent !== null && <Progress value={percent} className="mt-2 h-1.5 max-w-40" />}
          </>
        )}
      </div>
    </Link>
  );
}

type SeriesProgressDetail =
  | {
      kind: "active";
      book: Book | null;
      estimatedCompletion: string | null;
      readingPace: string;
    }
  | {
      kind: "not-started";
      book: Book | null;
      onStartReading: () => void;
      startDisabled: boolean;
    }
  | {
      kind: "completed";
      book: Book | null;
      started: string | null;
      finished: string | null;
      journeyLength: string;
    }
  | {
      kind: "hidden";
    };

function SeriesProgressCard({
  progress,
  totalBooks,
  averageRating,
  detail,
}: {
  progress: ReturnType<typeof getSeriesProgress>;
  totalBooks: number;
  averageRating: number | null;
  detail: SeriesProgressDetail;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-lg font-medium">
        Your Series <span className="font-serif italic">Progress</span>
      </h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="flex justify-center lg:justify-start">
          <CircularSeriesProgress value={progress.percentage} />
        </div>
        <div className="min-w-0">
          <ProgressStatRow
            icon={<BookOpen className="h-4 w-4" />}
            label="Books Read"
            value={`${progress.finishedBooks} / ${totalBooks}`}
          />
          <ProgressStatRow
            icon={<BookOpen className="h-4 w-4" />}
            label="Pages Read"
            value={formatPagesRead(progress.readPages, progress.totalPages)}
          />
          <ProgressStatRow
            icon={<Star className="h-4 w-4" />}
            label="Average Rating"
            value={
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-rating text-rating" />
                {averageRating === null ? "--" : averageRating.toFixed(1)}
              </span>
            }
          />
        </div>
      </div>
      {detail.kind === "active" && (
        <div className="mt-4 grid gap-5 border-t pt-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.9fr)]">
          <div>
            <p className="mb-2 text-sm font-semibold">Current Book</p>
            <FeaturedBookProgress book={detail.book} />
          </div>
          <div className="space-y-4 border-t pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <div>
              <p className="text-sm font-semibold">Estimated Completion</p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                {formatDate(detail.estimatedCompletion)}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Reading Pace</p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Gauge className="h-4 w-4 text-primary" />
                {detail.readingPace}
              </p>
            </div>
          </div>
        </div>
      )}
      {detail.kind === "not-started" && (
        <div className="mt-4 grid gap-5 border-t pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="mb-2 text-sm font-semibold">First Volume</p>
            <FeaturedBookProgress book={detail.book} showProgress={false} />
          </div>
          <Button type="button" onClick={detail.onStartReading} disabled={detail.startDisabled}>
            {detail.startDisabled ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Reading"
            )}
          </Button>
        </div>
      )}
      {detail.kind === "completed" && (
        <div className="mt-4 grid gap-5 border-t pt-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.9fr)]">
          <div>
            <p className="mb-2 text-sm font-semibold">Favorite Book</p>
            <FeaturedBookProgress book={detail.book} showProgress={false} />
          </div>
          <div className="space-y-4 border-t pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <div>
              <p className="text-sm font-semibold">Start and Finish Date</p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                {formatDate(detail.started)} - {formatDate(detail.finished)}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Journey Length</p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Route className="h-4 w-4 text-primary" />
                {detail.journeyLength}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SeriesAboutSection({
  description,
  expanded,
  onExpandedChange,
}: {
  description: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const measurementRef = useRef<HTMLParagraphElement>(null);
  const [hasHiddenDescription, setHasHiddenDescription] = useState(false);
  const shouldClamp = hasHiddenDescription && !expanded;

  useEffect(() => {
    const element = measurementRef.current;
    if (!element) {
      setHasHiddenDescription(false);
      return;
    }

    const measure = () => {
      setHasHiddenDescription(element.scrollHeight > element.clientHeight + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [description]);

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-2xl font-medium leading-snug">
        <span className="font-serif italic">About</span> this Series
      </h2>
      <div className="relative space-y-3">
        {description ? (
          <>
            <p
              ref={measurementRef}
              className="pointer-events-none invisible absolute inset-x-0 top-0 whitespace-pre-line text-sm leading-7 line-clamp-4 lg:line-clamp-[11]"
              aria-hidden
            >
              {description}
            </p>
            <p className={cn("whitespace-pre-line text-sm leading-7 text-muted-foreground", shouldClamp && "line-clamp-4 lg:line-clamp-[11]")}>
              {description}
            </p>
            {hasHiddenDescription && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0 text-sm text-muted-foreground"
                onClick={() => onExpandedChange(!expanded)}
              >
                {expanded ? "Show Less" : "Show More"}
                <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No description yet.</p>
        )}
      </div>
    </section>
  );
}

function ExploreBooksCard({
  title,
  books,
  onBook,
  emptyLabel = "No matches in your library yet.",
}: {
  title: ReactNode;
  books: Book[];
  onBook: (book: Book) => void;
  emptyLabel?: string;
}) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {books.length === 0 ? (
        <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {books.slice(0, 3).map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => onBook(book)}
              className="group min-w-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`Open ${book.title}`}
            >
              <div className="aspect-[2/3] overflow-hidden rounded-md border bg-muted">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </article>
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

function getNextEditableVolume(rows: EditableSeriesBook[]): number {
  const visibleRows = rows.filter((row) => !row.removed);
  const largestVolume = visibleRows.reduce((largest, row) => {
    const volume = parseVolumeInput(row.volumeInput);
    return volume === null ? largest : Math.max(largest, volume);
  }, 0);
  return largestVolume + 1 || visibleRows.length + 1;
}

function SeriesEditPage({
  series,
  seriesBooks,
  allBooks,
  userId,
  saving,
  onCancel,
  onSave,
  onCreateBook,
}: {
  series: Series;
  seriesBooks: Book[];
  allBooks: Book[];
  userId: string | undefined;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: {
    name: string;
    description: string | null;
    cover_url?: string | null;
    rows: EditableSeriesBook[];
  }) => Promise<void>;
  onCreateBook: (rows: EditableSeriesBook[], onSaved: (book: Book, volumeNumber: number) => void) => void;
}) {
  const [name, setName] = useState(series.name);
  const [description, setDescription] = useState(series.description ?? "");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [rows, setRows] = useState<EditableSeriesBook[]>(() => buildEditableSeriesBooks(seriesBooks));
  const [error, setError] = useState<string | null>(null);
  const shownBannerUrl = bannerPreview ?? (!removeBanner ? series.cover_url : null);

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  function handleBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setRemoveBanner(false);
  }

  function handleRemoveBanner() {
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(null);
    setBannerPreview(null);
    setRemoveBanner(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    const invalidRow = rows.find((row) => !row.removed && parseVolumeInput(row.volumeInput) === null);
    if (invalidRow) {
      setError(`Add a positive volume number with at most two decimal places for "${invalidRow.book.title}" before saving.`);
      return;
    }

    setError(null);
    let coverUrl: string | null | undefined;
    let keepExtension: string | null | undefined;

    try {
      if (bannerFile) {
        if (!userId) throw new Error("You must be signed in to upload a banner.");
        const upload = await uploadSeriesBanner(userId, series.id, bannerFile);
        coverUrl = upload.publicUrl;
        keepExtension = upload.extension;
      } else if (removeBanner) {
        coverUrl = null;
      }

      await onSave({
        name: trimmedName,
        description: description.trim() || null,
        ...(coverUrl !== undefined ? { cover_url: coverUrl } : {}),
        rows,
      });

      if (userId && (bannerFile || removeBanner)) {
        await deleteSeriesBanner(userId, series.id, keepExtension).catch(() => {});
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save series.");
    }
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo="/series" />

      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="series-banner">Banner image</Label>
              <label
                htmlFor="series-banner"
                className="flex aspect-[16/7] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-primary/60"
              >
                {shownBannerUrl ? (
                  <img src={shownBannerUrl} alt="Series banner preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs">Click to upload</span>
                  </div>
                )}
              </label>
              <input
                id="series-banner"
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={saving}
                onChange={handleBannerChange}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {bannerFile ? bannerFile.name : "PNG, JPG, WEBP, or AVIF."}
                </p>
                {shownBannerUrl && (
                  <Button type="button" variant="outline" size="sm" disabled={saving} onClick={handleRemoveBanner}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-series-name">Series name *</Label>
              <Input
                id="edit-series-name"
                value={name}
                disabled={saving}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-series-description">Description</Label>
              <Textarea
                id="edit-series-description"
                rows={6}
                value={description}
                disabled={saving}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          <section className="space-y-3">
            <div>
              <h2 className="font-heading text-lg font-medium">Books in this series</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Search for books, drag by the handle, edit volume numbers, or remove books from this series.
              </p>
            </div>
            <SeriesBooksEditor
              rows={rows}
              allBooks={allBooks}
              saving={saving}
              enableSearch
              emptyLabel="No books will remain in this series."
              removedLabel={(count) =>
                `${count} book${count === 1 ? "" : "s"} will be removed from this series when you save.`
              }
              onRowsChange={setRows}
              onCreateBook={() =>
                onCreateBook(rows, (book, volumeNumber) => {
                  setRows((currentRows) => {
                    if (currentRows.some((row) => row.book.id === book.id)) return currentRows;
                    return [
                      ...currentRows,
                      {
                        book,
                        volumeInput: book.volume_number ? String(book.volume_number) : String(volumeNumber),
                        removed: false,
                      },
                    ];
                  });
                })
              }
            />
          </section>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-5 border-t pt-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Series"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function SeriesDetails() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const { user } = useAuth();
  const {
    books,
    loading: booksLoading,
    error: booksError,
    updateBook,
    updateBookSeriesPlacement,
    updateBookVolumeNumber,
  } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError, editSeries, removeSeries } = useSeries();
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendAttachmentOpen, setSendAttachmentOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingSeries, setSavingSeries] = useState(false);
  const [startingBookId, setStartingBookId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

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

  const loadJournalEntries = useCallback(async () => {
    try {
      setJournalEntries(await fetchAllBookJournalEntryRecords());
    } catch {
      setJournalEntries([]);
    }
  }, []);

  useEffect(() => {
    if (!seriesRecord) {
      if (!seriesLoading) setLogsLoading(false);
      return;
    }
    if (seriesBooks.length === 0) {
      setLogs([]);
      setJournalEntries([]);
      setLogsError(null);
      setLogsLoading(false);
      return;
    }
    void loadLogs();
    void loadJournalEntries();
  }, [loadLogs, loadJournalEntries, seriesBooks.length, seriesLoading, seriesRecord]);

  const seriesLogs = useMemo(() => filterSeriesLogs(seriesBooks, logs), [logs, seriesBooks]);
  const seriesBookIds = useMemo(() => new Set(seriesBooks.map((book) => book.id)), [seriesBooks]);
  const progress = useMemo(() => getSeriesProgress(seriesBooks), [seriesBooks]);
  const authors = useMemo(() => getSeriesAuthors(seriesBooks), [seriesBooks]);
  const genres = useMemo(() => getSeriesGenres(seriesBooks), [seriesBooks]);
  const averageRating = useMemo(() => getAverageSeriesRating(seriesBooks), [seriesBooks]);
  const currentBook = useMemo(() => getCurrentSeriesBook(seriesBooks), [seriesBooks]);
  const derivedStatus = useMemo(() => getDerivedSeriesStatus(seriesBooks), [seriesBooks]);
  const firstVolume = useMemo(() => sortSeriesBooks(seriesBooks)[0] ?? null, [seriesBooks]);
  const journeyRecap = useMemo(
    () => getSeriesJourneyRecap(seriesBooks, seriesLogs),
    [seriesBooks, seriesLogs],
  );
  const seriesStats = useMemo(
    () => getSeriesStats(seriesBooks, seriesLogs, journalEntries),
    [journalEntries, seriesBooks, seriesLogs],
  );
  const completionDates = useMemo(
    () => getSeriesCompletionDates(seriesBooks, seriesLogs),
    [seriesBooks, seriesLogs],
  );
  const estimatedCompletion = useMemo(
    () => estimateSeriesCompletionDate(seriesBooks, seriesLogs),
    [seriesBooks, seriesLogs],
  );
  const readingPace = useMemo(
    () => (logsLoading || logsError ? "--" : formatReadingPace(seriesBooks, seriesLogs)),
    [logsError, logsLoading, seriesBooks, seriesLogs],
  );
  const primaryAuthor = authors[0] ?? "this author";
  const exploreGenre = useMemo(
    () => getMostPopularMatchingGenre(genres, books),
    [books, genres],
  );
  const moreByAuthor = useMemo(() => {
    const author = primaryAuthor.toLowerCase();
    return books
      .filter(
        (book) =>
          !seriesBookIds.has(book.id) &&
          book.authors.some((bookAuthor) => bookAuthor.toLowerCase() === author),
      )
      .slice(0, 3);
  }, [books, primaryAuthor, seriesBookIds]);
  const moreByGenre = useMemo(
    () =>
      exploreGenre
        ? books
            .filter(
              (book) =>
                !seriesBookIds.has(book.id) &&
                !moreByAuthor.some((authorBook) => authorBook.id === book.id) &&
                bookHasGenreName(book, exploreGenre),
            )
            .slice(0, 3)
        : [],
    [books, exploreGenre, moreByAuthor, seriesBookIds],
  );

  const progressDetail = useMemo<SeriesProgressDetail>(() => {
    if (derivedStatus === "Not Started") {
      return {
        kind: "not-started",
        book: firstVolume,
        onStartReading: () => {
          if (firstVolume) void handleStartReading(firstVolume);
        },
        startDisabled: !firstVolume || startingBookId === firstVolume.id,
      };
    }

    if (derivedStatus === "Completed") {
      return {
        kind: "completed",
        book: journeyRecap.favoriteBook,
        started: completionDates.started,
        finished: completionDates.finished,
        journeyLength: formatJourneyLength(seriesStats.overview.journeySpan),
      };
    }

    if (derivedStatus === "Ongoing") {
      return {
        kind: "active",
        book: currentBook,
        estimatedCompletion,
        readingPace,
      };
    }

    return { kind: "hidden" };
  }, [
    completionDates.finished,
    completionDates.started,
    currentBook,
    derivedStatus,
    estimatedCompletion,
    firstVolume,
    journeyRecap.favoriteBook,
    readingPace,
    seriesStats.overview.journeySpan,
    startingBookId,
  ]);

  function openAttachmentPicker() {
    setSendAttachmentOpen(true);
  }

  async function handleStartReading(book: Book) {
    try {
      setActionError(null);
      setStartingBookId(book.id);
      await updateBook(book.id, {
        status: "Reading",
        ...(book.date_started ? {} : { date_started: getTodayLocalDate() }),
      });
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to start reading"));
    } finally {
      setStartingBookId(null);
    }
  }

  async function handleDeleteSeries() {
    if (!seriesRecord) return;
    try {
      setActionError(null);
      await removeSeries(seriesRecord.id);
      navigate("/series", { replace: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete series");
    }
  }

  async function handleToggleFavorite() {
    if (!seriesRecord) return;
    try {
      setActionError(null);
      await editSeries(seriesRecord.id, { is_favorite: !seriesRecord.is_favorite });
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to update series"));
    }
  }

  async function handleSaveSeriesEdit(input: {
    name: string;
    description: string | null;
    cover_url?: string | null;
    rows: EditableSeriesBook[];
  }) {
    if (!seriesRecord) return;

    try {
      setSavingSeries(true);
      setActionError(null);

      const seriesPayload: Parameters<typeof editSeries>[1] = {};
      if (input.name !== seriesRecord.name) seriesPayload.name = input.name;
      if ((input.description ?? null) !== (seriesRecord.description ?? null)) {
        seriesPayload.description = input.description;
      }
      if (input.cover_url !== undefined && input.cover_url !== (seriesRecord.cover_url ?? null)) {
        seriesPayload.cover_url = input.cover_url;
      }

      if (Object.keys(seriesPayload).length > 0) {
        await editSeries(seriesRecord.id, seriesPayload);
      }

      for (const row of input.rows) {
        const nextVolume = parseVolumeInput(row.volumeInput);
        if (row.removed) {
          if (row.book.series_id === seriesRecord.id) {
            await updateBookSeriesPlacement(row.book.id, {
              series_id: null,
              volume_number: null,
            });
          }
          continue;
        }

        if (row.book.series_id !== seriesRecord.id) {
          await updateBookSeriesPlacement(row.book.id, {
            series_id: seriesRecord.id,
            volume_number: nextVolume,
          });
          continue;
        }

        if (nextVolume !== null && nextVolume !== row.book.volume_number) {
          await updateBookVolumeNumber(row.book.id, nextVolume);
        }
      }

      setIsEditMode(false);
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to save series"));
      throw error;
    } finally {
      setSavingSeries(false);
    }
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
        <BackButton fallbackTo="/series" />
      </div>
    );
  }

  const headerAuthors = authors.length > 0 ? authors.join(", ") : "Unknown author";

  if (isEditMode) {
    return (
      <div className="space-y-6">
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        <SeriesEditPage
          series={seriesRecord}
          seriesBooks={seriesBooks}
          allBooks={books}
          userId={user?.id}
          saving={savingSeries}
          onCancel={() => {
            setActionError(null);
            setIsEditMode(false);
          }}
          onSave={handleSaveSeriesEdit}
          onCreateBook={(rows, onSaved) => {
            const nextVolume = getNextEditableVolume(rows);
            openAddBook({
              initialSeriesId: seriesRecord.id,
              initialVolumeNumber: nextVolume,
              onSaved: (book) => onSaved(book, nextVolume),
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      {shareStatus && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
          {shareStatus}
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <BackButton fallbackTo="/series" />
        <DetailActionsMenu
          kind="series"
          label={seriesRecord.name}
          shareAttachmentLabel="Send the series as attachment in a chat"
          onEdit={() => setIsEditMode(true)}
          onDelete={handleDeleteSeries}
          onSendAttachment={openAttachmentPicker}
          deleteTitle="Delete this series?"
          deleteDescription="Are you sure you want to delete this series? The books will stay in your library and be detached from this series."
        />
      </div>

      <header className="relative flex min-h-64 items-end overflow-hidden rounded-2xl border bg-muted">
        {seriesRecord.cover_url ? (
          <img
            src={seriesRecord.cover_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 bg-primary"
            aria-label="Series banner placeholder"
          />
        )}
        <div className="absolute inset-0 bg-foreground/45" />
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleToggleFavorite()}
            aria-label={seriesRecord.is_favorite ? "Remove series from favorites" : "Add series to favorites"}
            className="flex h-10 w-10 items-center justify-center text-white transition-colors hover:text-white/80"
          >
            <Heart
              className={cn(
                "h-5 w-5",
                seriesRecord.is_favorite ? "fill-favorite text-favorite" : "text-white",
              )}
            />
          </button>
        </div>
        <div className="relative space-y-3 p-6 text-white sm:p-8">
          <h1 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl">
            {seriesRecord.name}
          </h1>
          <p className="text-base text-white/85">by {headerAuthors}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
            <span>{bookCountLabel(seriesBooks.length)}</span>
            <span aria-hidden>·</span>
            <span>{genres.slice(0, 2).join(", ") || "No genre"}</span>
            <span aria-hidden>·</span>
            <span>{derivedStatus}</span>
          </div>
        </div>
      </header>

      {seriesBooks.length === 0 ? (
        <EmptySection message="Books added to this series will appear here." />
      ) : (
        <div className="space-y-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)] lg:items-start">
            <SeriesAboutSection
              description={seriesRecord.description?.trim() ?? ""}
              expanded={descriptionExpanded}
              onExpandedChange={setDescriptionExpanded}
            />
            <SeriesProgressCard
              progress={progress}
              totalBooks={seriesBooks.length}
              averageRating={averageRating}
              detail={progressDetail}
            />
          </div>

          <section className="space-y-4">
            <SectionHeader title={<span className="font-serif italic">Books</span>} action={<ViewMoreLink to={`/series/${seriesRecord.id}/books`} label="View All" />} />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(144px,1fr))]">
              {seriesBooks.slice(0, 8).map((book) => (
                <BookCard key={book.id} book={book} onClick={(item) => navigate(`/books/${item.id}`)} textSize="compact" />
              ))}
            </div>
          </section>

          <SeriesJournalSection series={seriesRecord} />

          <section className="space-y-4">
            <SectionHeader title={<span className="font-serif italic">Analytics</span>} action={<ViewMoreLink to={`/series/${seriesRecord.id}/analytics`} />} />
            <SeriesAnalyticsOverview stats={seriesStats} logsLoading={logsLoading} logsError={logsError} />
            <SeriesAnalyticsPaceChart stats={seriesStats} />
          </section>

          <section className="space-y-5">
            <SectionHeader title={<>More to <span className="font-serif italic">Explore</span></>} />
            <div className="grid gap-5 lg:grid-cols-3">
              <ExploreBooksCard
                title={<>More by <span className="font-serif italic">{primaryAuthor}</span></>}
                books={moreByAuthor}
                onBook={(book) => navigate(`/books/${book.id}`)}
              />
              <ExploreBooksCard
                title={
                  exploreGenre ? (
                    <>More in <span className="font-serif italic">{exploreGenre}</span></>
                  ) : (
                    "More in this genre"
                  )
                }
                books={moreByGenre}
                onBook={(book) => navigate(`/books/${book.id}`)}
              />
              <article className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-medium">
                  You Might Also <span className="font-serif italic">Like</span>
                </h3>
                <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
                  Recommendations coming later.
                </div>
              </article>
            </div>
          </section>
        </div>
      )}
      <SendAttachmentDialog
        open={sendAttachmentOpen}
        onOpenChange={setSendAttachmentOpen}
        attachment={buildSeriesAttachment({
          seriesId: seriesRecord.id,
          seriesName: seriesRecord.name,
          books: seriesBooks,
          includedQuotes: journalEntries
            .filter((note) => note.label === "quote" && seriesBookIds.has(note.book_id))
            .slice(0, 3),
        })}
        title={`Send "${seriesRecord.name}" to chat`}
        description="Add a message, then pick the chat you want to send this series to."
        onSent={() => setShareStatus("Series sent to chat.")}
      />
    </div>
  );
}
