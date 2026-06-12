import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Clock,
  Heart,
  ImagePlus,
  Info,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import AnnotationCard from "@/components/AnnotationCard";
import GenreMultiSelect from "@/components/GenreMultiSelect";
import ProgressOverTimeChart from "@/components/ProgressOverTimeChart";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import {
  formatCalendarSpan,
  formatPagesPerDay,
  formatTotalReadingTime,
  getCalendarPagesPerDay,
  getEstimatedFinish,
  getReadingDuration,
  sumReadingMinutes,
} from "@/lib/bookAnalytics";
import { getAllowedGenres } from "@/lib/bookGenres";
import { fetchBookNotes, sortBookNotes } from "@/lib/bookNotes";
import { fetchReadingLogsForBook } from "@/lib/books";
import {
  formatPublicationDateForDisplay,
  formatPublicationDateInput,
  parsePublicationDateInput,
  trimPublicationDateInputForPrecision,
} from "@/lib/publicationDate";
import {
  formatAuthorsInput,
  getTodayLocalDate,
  parseAuthorsInput,
} from "@/lib/utils";
import type {
  Book,
  BookFormat,
  BookLanguage,
  BookNote,
  BookNoteLabel,
  BookSource,
  BookStatus,
  PublicationDatePrecision,
  ReadingLog,
} from "@/types";

interface FormValues {
  title: string;
  authorsInput: string;
  status: BookStatus;
  genres: string[];
  isbn: string;
  language: BookLanguage | "";
  format: BookFormat | "";
  source: BookSource | "";
  total_pages: string;
  publisher: string;
  publication_date: string;
  publication_date_precision: PublicationDatePrecision | "";
  description: string;
  date_started: string;
  date_finished: string;
  series_id: string;
  volume_number: string;
}

const STATUS_OPTIONS: BookStatus[] = [
  "Not Started",
  "Wishlist",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

const SOURCE_OPTIONS: BookSource[] = ["Owned", "Family", "Friends", "Library"];

type ProgressStat = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function bookToFormValues(book: Book): FormValues {
  return {
    title: book.title,
    authorsInput: formatAuthorsInput(book.authors),
    status: book.status,
    genres: book.genres ?? [],
    isbn: book.isbn ?? "",
    language: book.language ?? "",
    format: book.format ?? "",
    source: book.source ?? "",
    total_pages: book.total_pages?.toString() ?? "",
    publisher: book.publisher ?? "",
    publication_date: formatPublicationDateInput(
      book.publication_date,
      book.publication_date_precision,
    ),
    publication_date_precision: book.publication_date_precision ?? "",
    description: book.description ?? "",
    date_started: book.date_started ?? "",
    date_finished: book.date_finished ?? "",
    series_id: book.series_id ?? "",
    volume_number: book.volume_number?.toString() ?? "",
  };
}

function formatDateForDisplay(value?: string | null): string {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateObjectForDisplay(value: Date | null): string {
  if (!value) return "Not available";
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getProgressPercent(book: Book): number {
  const currentPage = book.current_page ?? 0;
  const totalPages = book.total_pages ?? 0;
  if (totalPages <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
}

function pickPreviewNotes(notes: BookNote[], label: BookNoteLabel): BookNote[] {
  return sortBookNotes(notes.filter((note) => note.label === label))
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
    .slice(0, 3);
}

export default function BookDetails() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { books, loading, error, updateBook, updateCover, deleteBook, reload } = useBooksContext();
  const { series } = useSeries();

  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;
  const seriesName = book?.series_id
    ? series.find((item) => item.id === book.series_id)?.name
    : undefined;

  const [isFavorite, setIsFavorite] = useState(false);
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [showRatingGuide, setShowRatingGuide] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { isDirty, dirtyFields, errors },
  } = useForm<FormValues>();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setIsProgressDialogOpen(false);
  }, [bookId]);

  useEffect(() => {
    if (!book) return;
    setIsFavorite(book.is_favorite);
    setLocalRating(book.rating ?? null);
    setIsEditMode(false);
    setConfirmDelete(false);
    setErrorMsg(null);
    setDescriptionExpanded(false);
    reset(bookToFormValues(book));
  }, [book, reset]);

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
        if (!cancelled) setLogsError(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    const currentBookId = bookId;
    let cancelled = false;

    async function run() {
      try {
        setNotesLoading(true);
        setNotesError(null);
        const data = await fetchBookNotes(currentBookId);
        if (!cancelled) setNotes(data);
      } catch (err) {
        if (!cancelled) setNotesError(err instanceof Error ? err.message : "Failed to load notes");
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const watchedSeriesId = watch("series_id");
  const publicationDate = watch("publication_date") ?? "";
  const publicationDatePrecision = watch("publication_date_precision") ?? "";
  const progressPercent = book ? getProgressPercent(book) : 0;
  const totalReadingMinutes = useMemo(() => sumReadingMinutes(readingLogs), [readingLogs]);
  const readingDuration = useMemo(
    () =>
      getReadingDuration({
        dateStarted: book?.date_started,
        dateFinished: book?.date_finished,
      }),
    [book?.date_finished, book?.date_started],
  );
  const daysReading =
    readingDuration.isAvailable && readingDuration.span
      ? formatCalendarSpan(readingDuration.span)
      : "Not set";
  const estimatedFinish = useMemo(
    () =>
      getEstimatedFinish({
        status: book?.status ?? "Not Started",
        currentPage: book?.current_page,
        totalPages: book?.total_pages,
        logs: readingLogs,
      }),
    [book?.current_page, book?.status, book?.total_pages, readingLogs],
  );

  const relatedByAuthor = useMemo(() => {
    if (!book) return [];
    const authors = new Set(book.authors.map((author) => author.toLowerCase()));
    return books
      .filter(
        (item) =>
          item.id !== book.id &&
          item.authors.some((author) => authors.has(author.toLowerCase())),
      )
      .slice(0, 3);
  }, [book, books]);

  const relatedByGenre = useMemo(() => {
    if (!book || !book.genres?.length) return [];
    const genres = new Set(book.genres.map((genre) => genre.toLowerCase()));
    return books
      .filter(
        (item) =>
          item.id !== book.id &&
          item.genres?.some((genre) => genres.has(genre.toLowerCase())) &&
          !relatedByAuthor.some((authorBook) => authorBook.id === item.id),
      )
      .slice(0, 3);
  }, [book, books, relatedByAuthor]);

  function exitEditMode() {
    if (!book) return;
    reset(bookToFormValues(book));
    setConfirmDelete(false);
    setErrorMsg(null);
    setIsEditMode(false);
  }

  async function toggleFavorite() {
    if (!book) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await updateBook(book.id, { is_favorite: next });
    } catch {
      setIsFavorite(!next);
    }
  }

  async function handleRating(rating: number) {
    if (!book) return;
    const previous = localRating;
    const next = localRating === rating ? null : rating;
    setLocalRating(next);
    try {
      await updateBook(book.id, { rating: next });
    } catch {
      setLocalRating(previous);
    }
  }

  async function handleStatusChange(nextStatus: BookStatus) {
    if (!book || nextStatus === book.status) return;
    const payload: Partial<Book> = { status: nextStatus };
    if (nextStatus === "Reading" && !book.date_started) payload.date_started = getTodayLocalDate();
    if (nextStatus === "Finished" && !book.date_finished) payload.date_finished = getTodayLocalDate();

    try {
      setErrorMsg(null);
      await updateBook(book.id, payload);
      reset(bookToFormValues({ ...book, ...payload }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    if (!book) return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingCover(true);
      setErrorMsg(null);
      await updateCover(book.id, file);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update cover");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    if (!book) return;
    const payload: Partial<Book> = {};

    if (dirtyFields.title) payload.title = values.title.trim();
    if (dirtyFields.authorsInput) {
      const authors = parseAuthorsInput(values.authorsInput);
      if (authors.length === 0) {
        setErrorMsg("At least one author is required");
        return;
      }
      payload.authors = authors;
    }
    if (dirtyFields.genres) {
      const allowedGenres = getAllowedGenres(values.genres);
      payload.genres = allowedGenres.length > 0 ? allowedGenres : undefined;
    }
    if (dirtyFields.isbn) {
      payload.isbn = values.isbn.trim() || undefined;
      payload.metadata_source = null;
      payload.metadata_source_url = null;
    }
    if (dirtyFields.language) payload.language = (values.language as BookLanguage) || undefined;
    if (dirtyFields.format) payload.format = (values.format as BookFormat) || undefined;
    if (dirtyFields.source) payload.source = (values.source as BookSource) || undefined;
    if (dirtyFields.total_pages) {
      payload.total_pages = values.total_pages ? Number(values.total_pages) : undefined;
    }
    if (dirtyFields.publisher) payload.publisher = values.publisher.trim() || undefined;
    if (dirtyFields.publication_date || dirtyFields.publication_date_precision) {
      const parsedPublicationDate = parsePublicationDateInput(
        values.publication_date,
        values.publication_date_precision,
      );
      if (values.publication_date.trim() && !values.publication_date_precision) {
        setError("publication_date", { message: "Select which parts of the date count." });
        return;
      }
      if (values.publication_date.trim() && !parsedPublicationDate) {
        setError("publication_date", {
          message: "Use YYYY, YYYY-MM, or YYYY-MM-DD to match the selected boxes.",
        });
        return;
      }
      payload.publication_date = parsedPublicationDate?.date ?? null;
      payload.publication_date_precision = parsedPublicationDate?.precision ?? null;
    }
    if (dirtyFields.description) payload.description = values.description.trim() || undefined;
    if (dirtyFields.date_started) payload.date_started = values.date_started || undefined;
    if (dirtyFields.date_finished) payload.date_finished = values.date_finished || undefined;
    if (dirtyFields.series_id) payload.series_id = values.series_id || undefined;
    if (dirtyFields.volume_number) {
      payload.volume_number = values.volume_number ? Number(values.volume_number) : undefined;
    }

    if (Object.keys(payload).length === 0) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      await updateBook(book.id, payload);
      reset(values);
      setIsEditMode(false);
      setConfirmDelete(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!book) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setDeleting(true);
      setErrorMsg(null);
      await deleteBook(book.id);
      navigate("/library", { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete book");
    } finally {
      setDeleting(false);
    }
  }

  function updatePublicationDatePrecision(nextPrecision: PublicationDatePrecision | "") {
    setValue(
      "publication_date",
      trimPublicationDateInputForPrecision(publicationDate, nextPrecision),
      { shouldDirty: true, shouldTouch: true },
    );
    setValue("publication_date_precision", nextPrecision, {
      shouldDirty: true,
      shouldTouch: true,
    });
    clearErrors("publication_date");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
          <div className="space-y-3">
            <div className="h-10 w-4/5 animate-pulse rounded-md bg-muted" />
            <div className="h-5 w-2/3 animate-pulse rounded-md bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
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
        <p className="max-w-md text-sm text-muted-foreground">
          This book may not exist, may have been deleted, or you may not have access.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to="/library">Back to Library</Link>
        </Button>
      </div>
    );
  }

  const currentPage = book.current_page ?? 0;
  const totalPages = book.total_pages ?? 0;
  const readingProgressStats: ProgressStat[] =
    book.status === "Reading"
      ? [
          {
            icon: Calendar,
            label: "Started On",
            value: formatDateForDisplay(book.date_started),
          },
          {
            icon: TrendingUp,
            label: "Current Pace",
            value: formatPagesPerDay(
              getCalendarPagesPerDay({
                pages: currentPage,
                dateStarted: book.date_started,
              }),
            ),
          },
          {
            icon: Clock,
            label: "Time Reading",
            value: formatTotalReadingTime(totalReadingMinutes),
          },
          {
            icon: CalendarClock,
            label: "Estimated Finish",
            value:
              estimatedFinish.isAvailable && estimatedFinish.finishDate
                ? formatDateObjectForDisplay(estimatedFinish.finishDate)
                : "Not available",
          },
        ]
      : book.status === "Finished"
        ? [
            {
              icon: Calendar,
              label: "Started On",
              value: formatDateForDisplay(book.date_started),
            },
            {
              icon: CalendarCheck,
              label: "Finished On",
              value: formatDateForDisplay(book.date_finished),
            },
            {
              icon: Clock,
              label: "Total Reading Time",
              value: formatTotalReadingTime(totalReadingMinutes),
            },
            {
              icon: TrendingUp,
              label: "Average Pace",
              value: formatPagesPerDay(
                getCalendarPagesPerDay({
                  pages: totalPages,
                  dateStarted: book.date_started,
                  dateEnded: book.date_finished,
                }),
              ),
            },
          ]
        : [
            {
              icon: Calendar,
              label: "Started On",
              value: formatDateForDisplay(book.date_started),
            },
            {
              icon: TrendingUp,
              label: "Current Page",
              value: `${currentPage} / ${totalPages || "-"}`,
            },
            {
              icon: Clock,
              label: "Time Reading",
              value: formatTotalReadingTime(totalReadingMinutes),
            },
            {
              icon: Calendar,
              label: "Days Reading",
              value: daysReading,
            },
          ];
  const description = book.description?.trim() || "";
  const shouldCollapseDescription = description.length > 420;
  const previewNotes = {
    quote: pickPreviewNotes(notes, "quote"),
    note: pickPreviewNotes(notes, "note"),
    review: pickPreviewNotes(notes, "review"),
  };
  const annotationCounts = {
    quote: notes.filter((note) => note.label === "quote").length,
    note: notes.filter((note) => note.label === "note").length,
    review: notes.filter((note) => note.label === "review").length,
  };

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" className="px-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back
      </Button>

      <section className="grid gap-6 md:grid-cols-[240px_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[240px]">
          <label
            htmlFor="cover-change"
            className={`relative block aspect-[2/3] overflow-hidden rounded-xl border bg-muted shadow-sm group ${
              isEditMode ? "cursor-pointer" : "cursor-default"
            }`}
          >
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${
                isEditMode ? "opacity-0 group-hover:opacity-100" : "opacity-0"
              }`}
            >
              {uploadingCover ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ImagePlus className="h-5 w-5 text-white" />
              )}
            </div>
            <input
              id="cover-change"
              type="file"
              accept="image/*"
              className="sr-only"
              ref={coverInputRef}
              onChange={handleCoverChange}
              disabled={uploadingCover || !isEditMode}
            />
          </label>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <h1 className="text-4xl font-heading leading-tight font-medium">{book.title}</h1>
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                className="mt-2 shrink-0 rounded p-1 transition-colors hover:bg-muted"
              >
                <Heart
                  className={`h-5 w-5 ${
                    isFavorite ? "fill-favorite text-favorite" : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>

            {seriesName && (
              <p className="text-sm text-muted-foreground">
                {seriesName}
                {book.volume_number != null ? ` · Book ${book.volume_number}` : ""}
              </p>
            )}
            <p className="text-base text-muted-foreground">by {book.authors.join(", ")}</p>

            <div className="mt-4 flex flex-wrap items-center gap-1">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleRating(n)}
                    aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                    className="rounded p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        localRating && n <= localRating
                          ? "fill-rating text-rating"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <div className="relative ml-2 flex items-center">
                <button
                  type="button"
                  aria-label="Show rating guide"
                  aria-expanded={showRatingGuide}
                  aria-describedby={showRatingGuide ? "rating-guide-tooltip" : undefined}
                  onClick={() => setShowRatingGuide((current) => !current)}
                  className="rounded-full p-0.5 text-muted-foreground/65 transition-colors hover:bg-muted/60 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
                {showRatingGuide && (
                  <div
                    id="rating-guide-tooltip"
                    role="tooltip"
                    className="absolute top-full right-0 z-20 mt-2 w-72 rounded-lg border border-border/70 bg-popover p-3 text-xs text-muted-foreground/75 shadow-sm sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
                  >
                    <div className="space-y-1.5">
                      <p className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/70">♥︎</span>
                        <span>One of the best books I’ve ever read</span>
                      </p>
                      <p className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/70">★★★★★</span>
                        <span>Loved it</span>
                      </p>
                      <p className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/70">★★★★☆</span>
                        <span>Really enjoyed it</span>
                      </p>
                      <p className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/70">★★★☆☆</span>
                        <span>Liked it, but didn’t wow me</span>
                      </p>
                      <p className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/70">★★☆☆☆</span>
                        <span>Meh, had issues</span>
                      </p>
                      <p className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/70">★☆☆☆☆</span>
                        <span>Not for me</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3">
              <Select value={book.status} onValueChange={(value) => handleStatusChange(value as BookStatus)}>
                <SelectTrigger className="h-10 w-40 bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="w-full max-w-[780px] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {currentPage} / {totalPages || "-"} pages
              </span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          <div className="flex flex-wrap gap-2">
            {book.status === "Reading" ? (
              <ReadingProgressDialog
                book={book}
                open={isProgressDialogOpen}
                onOpenChange={setIsProgressDialogOpen}
                onProgressSaved={async (newPage) => {
                  const shouldFinish =
                    typeof book.total_pages === "number" &&
                    book.total_pages > 0 &&
                    newPage >= book.total_pages;

                  await updateBook(book.id, {
                    current_page: newPage,
                    ...(shouldFinish
                      ? {
                          status: "Finished",
                          ...(book.date_finished ? {} : { date_finished: getTodayLocalDate() }),
                        }
                      : {}),
                  });
                  const data = await fetchReadingLogsForBook(book.id);
                  setReadingLogs(data);
                }}
                trigger={<Button type="button">Update Progress</Button>}
              />
            ) : (
              <Button
                type="button"
                onClick={async () => {
                  await handleStatusChange("Reading");
                  setIsProgressDialogOpen(true);
                }}
              >
                Start Reading
              </Button>
            )}
            <Button asChild type="button" variant="outline">
              <Link to={`/books/${book.id}/annotations?new=1`}>
                <MessageSquarePlus className="mr-1.5 h-4 w-4" />
                Add Note
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmDelete(false);
                setErrorMsg(null);
                setIsEditMode((current) => !current);
              }}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="More options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {isEditMode && (
        <EditDetailsForm
          control={control}
          register={register}
          handleSubmit={handleSubmit}
          onSubmit={onSubmit}
          onCancel={exitEditMode}
          onDelete={handleDelete}
          deleting={deleting}
          confirmDelete={confirmDelete}
          saving={saving}
          isDirty={isDirty}
          errors={errors}
          series={series}
          watchedSeriesId={watchedSeriesId}
          publicationDatePrecision={publicationDatePrecision}
          updatePublicationDatePrecision={updatePublicationDatePrecision}
          clearPublicationDateError={() => clearErrors("publication_date")}
        />
      )}

      {!isEditMode && (
        <>
          <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-xl font-heading leading-snug font-medium">
                <span className="font-serif italic">About</span> the Book
              </h2>
              <div className="mt-4 space-y-4">
                <p
                  className={`whitespace-pre-line text-sm leading-7 text-muted-foreground ${
                    shouldCollapseDescription && !descriptionExpanded ? "line-clamp-6" : ""
                  }`}
                >
                  {description || "No description yet."}
                </p>
                {shouldCollapseDescription && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0"
                    onClick={() => setDescriptionExpanded((current) => !current)}
                  >
                    {descriptionExpanded ? "Show less" : "Show more"}
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="space-y-5">
                <MetadataGroup title="Genres">
                  {book.genres?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {book.genres.map((genre) => (
                        <Badge key={genre} variant="secondary" className="font-sans font-normal">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not set</p>
                  )}
                </MetadataGroup>

                <div className="grid gap-4 sm:grid-cols-2">
                  <MetadataItem label="Language" value={book.language || "Not set"} />
                  <MetadataItem label="Format" value={book.format || "Not set"} />
                  <MetadataItem
                    label="Publication Date"
                    value={formatPublicationDateForDisplay(
                      book.publication_date,
                      book.publication_date_precision,
                    )}
                  />
                  <MetadataItem label="Publisher" value={book.publisher || "Not set"} />
                  <MetadataItem label="Source" value={book.source || "Not set"} />
                  <MetadataItem label="ISBN" value={book.isbn || "Not set"} />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-heading leading-snug font-medium">
                Reading <span className="font-serif italic">Progress</span>
              </h2>
              <Button asChild variant="link" className="px-0">
                <Link to={`/books/${book.id}/analytics`}>
                  View more
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <ProgressStatsStrip stats={readingProgressStats} />

            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-medium">Progress over time</h3>
              <div className="mt-4">
                {logsLoading ? (
                  <div className="h-52 animate-pulse rounded-lg bg-muted" />
                ) : logsError ? (
                  <p className="text-sm text-destructive">{logsError}</p>
                ) : (
                  <ProgressOverTimeChart logs={readingLogs} totalPages={book.total_pages} />
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-heading leading-snug font-medium">
                <span className="font-serif italic">Annotations</span>
              </h2>
              <Button asChild variant="link" className="px-0">
                <Link to={`/books/${book.id}/annotations`} className="text-primary">
                  View all notes
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <Tabs defaultValue="quote" className="space-y-4">
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-6 rounded-none border-0 border-b border-border bg-transparent p-0"
              >
                <TabsTrigger
                  value="quote"
                  className="h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground shadow-none data-active:bg-transparent data-active:text-primary data-active:shadow-none"
                >
                  Quotes ({annotationCounts.quote})
                </TabsTrigger>
                <TabsTrigger
                  value="note"
                  className="h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground shadow-none data-active:bg-transparent data-active:text-primary data-active:shadow-none"
                >
                  Notes ({annotationCounts.note})
                </TabsTrigger>
                <TabsTrigger
                  value="review"
                  className="h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground shadow-none data-active:bg-transparent data-active:text-primary data-active:shadow-none"
                >
                  Review ({annotationCounts.review})
                </TabsTrigger>
              </TabsList>
              {(["quote", "note", "review"] as BookNoteLabel[]).map((label) => (
                <TabsContent key={label} value={label}>
                  {notesLoading ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="h-44 animate-pulse rounded-lg bg-muted" />
                      <div className="h-44 animate-pulse rounded-lg bg-muted" />
                      <div className="h-44 animate-pulse rounded-lg bg-muted" />
                    </div>
                  ) : notesError ? (
                    <p className="text-sm text-destructive">{notesError}</p>
                  ) : previewNotes[label].length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      No {label === "quote" ? "quotes" : label === "review" ? "review" : "notes"} yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-3">
                      {previewNotes[label].map((note) => (
                        <AnnotationCard key={note.id} note={note} compact />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-heading leading-snug font-medium">
              More to <span className="font-serif italic">Explore</span>
            </h2>
            <div className="grid gap-5 lg:grid-cols-3">
              <RelatedBooksGroup
                title={
                  <>
                    More by{" "}
                    <span className="font-serif italic">{book.authors[0] ?? "this author"}</span>
                  </>
                }
                books={relatedByAuthor}
              />
              <RelatedBooksGroup
                title={
                  book.genres?.[0] ? (
                    <>
                      More in <span className="font-serif italic">{book.genres[0]}</span>
                    </>
                  ) : (
                    "More in this genre"
                  )
                }
                books={relatedByGenre}
              />
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-medium">
                  You Might Also <span className="font-serif italic">Like</span>
                </h3>
                <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  Recommendations coming later.
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetadataGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-sans text-xs font-normal uppercase tracking-wide text-muted-foreground/70">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-xs font-normal uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function ProgressStatsStrip({ stats }: { stats: ProgressStat[] }) {
  return (
    <div className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <ProgressStatItem
          key={stat.label}
          icon={stat.icon}
          label={stat.label}
          value={stat.value}
        />
      ))}
    </div>
  );
}

function ProgressStatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 border-b p-4 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function RelatedBooksGroup({ title, books }: { title: React.ReactNode; books: Book[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {books.length === 0 ? (
        <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No matches in your library yet.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {books.slice(0, 3).map((book) => (
            <Link key={book.id} to={`/books/${book.id}`} className="group min-w-0">
              <div className="aspect-[2/3] overflow-hidden rounded-md border bg-muted">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium leading-5">{book.title}</p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                {book.authors.join(", ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EditDetailsForm({
  control,
  register,
  handleSubmit,
  onSubmit,
  onCancel,
  onDelete,
  deleting,
  confirmDelete,
  saving,
  isDirty,
  errors,
  series,
  watchedSeriesId,
  publicationDatePrecision,
  updatePublicationDatePrecision,
  clearPublicationDateError,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  register: ReturnType<typeof useForm<FormValues>>["register"];
  handleSubmit: ReturnType<typeof useForm<FormValues>>["handleSubmit"];
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
  deleting: boolean;
  confirmDelete: boolean;
  saving: boolean;
  isDirty: boolean;
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
  series: { id: string; name: string }[];
  watchedSeriesId: string;
  publicationDatePrecision: PublicationDatePrecision | "";
  updatePublicationDatePrecision: (precision: PublicationDatePrecision | "") => void;
  clearPublicationDateError: () => void;
}) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="detail-title">Title</Label>
          <Input id="detail-title" {...register("title", { required: true })} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="detail-authors">Authors</Label>
          <Input
            id="detail-authors"
            {...register("authorsInput", {
              validate: (value) =>
                parseAuthorsInput(value).length > 0 || "At least one author is required",
            })}
          />
          {errors.authorsInput && (
            <p className="text-xs text-destructive">{errors.authorsInput.message}</p>
          )}
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label>Genres</Label>
          <Controller
            name="genres"
            control={control}
            render={({ field }) => (
              <GenreMultiSelect value={field.value ?? []} onChange={field.onChange} />
            )}
          />
        </div>

        <SelectField control={control} name="language" label="Language" options={["German", "Spanish", "English"]} />
        <SelectField control={control} name="format" label="Format" options={["eBook", "Audiobook", "Paperback", "Hardcover"]} />
        <SelectField control={control} name="source" label="Source" options={SOURCE_OPTIONS} />

        <div className="space-y-1.5">
          <Label htmlFor="detail-total-pages">Total pages</Label>
          <Input id="detail-total-pages" type="number" min={1} {...register("total_pages")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-publisher">Publisher</Label>
          <Input id="detail-publisher" {...register("publisher")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-publication-date">Publication date</Label>
          <Input
            id="detail-publication-date"
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
            aria-invalid={!!errors.publication_date}
            {...register("publication_date", {
              onChange: clearPublicationDateError,
            })}
          />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={!!publicationDatePrecision}
                onChange={(event) =>
                  updatePublicationDatePrecision(event.target.checked ? "year" : "")
                }
              />
              Year
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={publicationDatePrecision === "month" || publicationDatePrecision === "day"}
                onChange={(event) =>
                  updatePublicationDatePrecision(event.target.checked ? "month" : "year")
                }
              />
              Month
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={publicationDatePrecision === "day"}
                onChange={(event) =>
                  updatePublicationDatePrecision(event.target.checked ? "day" : "month")
                }
              />
              Day
            </label>
          </div>
          {errors.publication_date && (
            <p className="text-xs text-destructive">{errors.publication_date.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-date-started">Date started</Label>
          <Input id="detail-date-started" type="date" {...register("date_started")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-date-finished">Date finished</Label>
          <Input id="detail-date-finished" type="date" {...register("date_finished")} />
        </div>

        <div className="space-y-1.5">
          <Label>Series</Label>
          <Controller
            name="series_id"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || "__none__"}
                onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {series.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {watchedSeriesId && (
          <div className="space-y-1.5">
            <Label htmlFor="detail-volume-number">Volume number</Label>
            <Input id="detail-volume-number" type="number" min={0.5} step="any" {...register("volume_number")} />
          </div>
        )}

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="detail-isbn">ISBN</Label>
          <Input id="detail-isbn" inputMode="numeric" autoComplete="off" {...register("isbn")} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="detail-description">Description</Label>
          <Textarea id="detail-description" rows={6} {...register("description")} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={deleting} onClick={onDelete}>
          {deleting ? "Deleting..." : confirmDelete ? "Are you sure?" : "Delete"}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button type="submit" size="sm" disabled={saving || !isDirty}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={saving || deleting} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function SelectField({
  control,
  name,
  label,
  options,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: "language" | "format" | "source";
  label: string;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            value={field.value || "__none__"}
            onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Not set</SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}
