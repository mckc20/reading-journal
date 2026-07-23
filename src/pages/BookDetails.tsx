import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Clock,
  Heart,
  ImagePlus,
  Info,
  NotebookPen,
  PauseCircle,
  RefreshCw,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import AddAuthorDialog from "@/components/AddAuthorDialog";
import AuthorMultiSelect from "@/components/AuthorMultiSelect";
import BackButton from "@/components/BackButton";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import GenreMultiSelect from "@/components/GenreMultiSelect";
import JournalTimeline from "@/components/JournalTimeline";
import ProgressOverTimeChart from "@/components/ProgressOverTimeChart";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
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
import { Textarea } from "@/components/ui/textarea";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
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
import { fetchBookJournalEntryRecords, sortBookJournalEntryRecords } from "@/lib/bookJournal";
import { fetchReadingLogsForBook, uploadCover } from "@/lib/books";
import { buildBookAttachment } from "@/lib/chatAttachments";
import { buildAuthorSummaries, findAuthorSummary } from "@/lib/authorShelf";
import { buildGenreSlugLookup, formatGenrePathForDisplay, getSelectedGenreTags } from "@/lib/genreTree";
import {
  bookJournalToJournalEntries,
  isThoughtJournalEntry,
  sortJournalEntries,
} from "@/lib/journal";
import {
  formatPublicationDateForDisplay,
  formatPublicationDateInput,
  parsePublicationDateInput,
  trimPublicationDateInputForPrecision,
} from "@/lib/publicationDate";
import { bookHasGenreName, getBookGenreNames, getMostPopularMatchingGenre } from "@/lib/recommendations";
import { parseVolumeNumberInput } from "@/lib/volumeNumbers";
import {
  getTodayLocalDate,
  cn,
} from "@/lib/utils";
import type {
  Book,
  BookFormat,
  BookLanguage,
  BookJournalEntryRecord,
  BookSource,
  BookStatus,
  PublicationDatePrecision,
  ReadingLog,
} from "@/types";

interface FormValues {
  title: string;
  authors: string[];
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
  "To Read",
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
    authors: book.authors,
    status: book.status,
    genres: book.genre_ids ?? [],
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

function buildLibraryFilterPath(
  key: "language" | "format" | "publicationYear" | "publisher" | "source",
  value: string,
): string {
  const params = new URLSearchParams({ [key]: value });
  return `/library/explore?${params.toString()}`;
}

function getPublicationYear(value?: string | null): string | null {
  const [year] = (value ?? "").split("-");
  return year && /^\d{4}$/.test(year) ? year : null;
}

export default function BookDetails() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { setDetailEditingOpen } = useOutletContext<AppLayoutOutletContext>();
  const { user } = useAuth();
  const {
    books,
    loading,
    error,
    updateBook,
    pauseBook,
    resumeBook,
    deleteBook,
    reload,
  } = useBooksContext();
  const { genres } = useGenresContext();
  const { series } = useSeries();

  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const linkedGenres = useMemo(() => {
    if (!book?.selected_genres?.length) return [];
    return getSelectedGenreTags(book.selected_genres).map((genre) => ({
      genre,
      slug: slugById.get(genre.id) ?? genre.id,
    }));
  }, [book?.selected_genres, slugById]);
  const seriesName = book?.series_id
    ? series.find((item) => item.id === book.series_id)?.name
    : undefined;
  const publicationYear = getPublicationYear(book?.publication_date);

  const [isFavorite, setIsFavorite] = useState(false);
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [showRatingGuide, setShowRatingGuide] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const coverPreviewUrlRef = useRef<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(false);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);
  const [sendAttachmentOpen, setSendAttachmentOpen] = useState(false);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [authorDialogInitialName, setAuthorDialogInitialName] = useState("");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const { authors } = useAuthorsContext();
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
    setErrorMsg(null);
    setDescriptionExpanded(false);
    clearCoverDraft();
    reset(bookToFormValues(book));
  }, [book, reset]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrlRef.current) URL.revokeObjectURL(coverPreviewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    setDetailEditingOpen(isEditMode);

    return () => {
      setDetailEditingOpen(false);
    };
  }, [isEditMode, setDetailEditingOpen]);

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
        setJournalEntriesLoading(true);
        setJournalEntriesError(null);
        const data = await fetchBookJournalEntryRecords(currentBookId);
        if (!cancelled) setJournalEntries(data);
      } catch (err) {
        if (!cancelled) setJournalEntriesError(err instanceof Error ? err.message : "Failed to load journal entries");
      } finally {
        if (!cancelled) setJournalEntriesLoading(false);
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
        pausePeriods: book?.pause_periods,
      }),
    [book?.date_finished, book?.date_started, book?.pause_periods],
  );
  const daysReading =
    readingDuration.isAvailable && readingDuration.span
      ? formatCalendarSpan(readingDuration.span)
      : "Not set";
  const estimatedFinish = useMemo(
    () =>
      getEstimatedFinish({
        status: book?.status ?? "To Read",
        currentPage: book?.current_page,
        totalPages: book?.total_pages,
        logs: readingLogs,
        pausePeriods: book?.pause_periods,
      }),
    [book?.current_page, book?.pause_periods, book?.status, book?.total_pages, readingLogs],
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

  const authorSummaries = useMemo(
    () => buildAuthorSummaries(authors, books, journalEntries),
    [authors, books, journalEntries],
  );

  const exploreGenre = useMemo(
    () => (book ? getMostPopularMatchingGenre(getBookGenreNames(book), books) : null),
    [book, books],
  );

  const relatedByGenre = useMemo(() => {
    if (!book || !exploreGenre) return [];
    return books
      .filter(
        (item) =>
          item.id !== book.id &&
          bookHasGenreName(item, exploreGenre) &&
          !relatedByAuthor.some((authorBook) => authorBook.id === item.id),
      )
      .slice(0, 3);
  }, [book, books, exploreGenre, relatedByAuthor]);

  function exitEditMode() {
    if (!book) return;
    clearCoverDraft();
    reset(bookToFormValues(book));
    setErrorMsg(null);
    setIsEditMode(false);
  }

  function clearCoverDraft() {
    if (coverPreviewUrlRef.current) {
      URL.revokeObjectURL(coverPreviewUrlRef.current);
      coverPreviewUrlRef.current = null;
    }
    setCoverFile(null);
    setCoverPreviewUrl(null);
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

  async function handlePause() {
    if (!book || book.status !== "Reading") return;
    try {
      setErrorMsg(null);
      await pauseBook(book.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to pause book");
    }
  }

  async function handleResume() {
    if (!book || book.status !== "Paused") return;
    try {
      setErrorMsg(null);
      await resumeBook(book.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to resume book");
    }
  }

  async function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    if (!book) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (coverPreviewUrlRef.current) URL.revokeObjectURL(coverPreviewUrlRef.current);
    setCoverFile(file);
    const nextPreviewUrl = URL.createObjectURL(file);
    coverPreviewUrlRef.current = nextPreviewUrl;
    setCoverPreviewUrl(nextPreviewUrl);
    event.currentTarget.value = "";
  }

  function handleCreateAuthor(initialName: string) {
    setAuthorDialogInitialName(initialName);
    setAuthorDialogOpen(true);
  }

  function handleSavedAuthor(authorName: string) {
    const currentAuthors = watch("authors") ?? [];
    const nextAuthors = Array.from(
      new Map(
        [...currentAuthors, authorName]
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => [name.toLowerCase(), name] as const),
      ).values(),
    );
    setValue("authors", nextAuthors, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  const authorDialog = (
    <AddAuthorDialog
      open={authorDialogOpen}
      onOpenChange={setAuthorDialogOpen}
      initialName={authorDialogInitialName}
      onSaved={(author) => handleSavedAuthor(author.name)}
    />
  );

  async function onSubmit(values: FormValues) {
    if (!book || !user) return;
    const payload: Partial<Book> = {};

    if (dirtyFields.title) payload.title = values.title.trim();
    if (dirtyFields.authors) {
      const authors = values.authors.map((author) => author.trim()).filter(Boolean);
      if (authors.length === 0) {
        setErrorMsg("At least one author is required");
        return;
      }
      payload.authors = authors;
    }
    if (dirtyFields.genres) {
      payload.genre_ids = values.genres;
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
      const parsedVolumeNumber = values.volume_number
        ? parseVolumeNumberInput(values.volume_number)
        : null;
      if (values.volume_number && parsedVolumeNumber === null) {
        setError("volume_number", {
          message: "Use a positive number with at most two decimal places.",
        });
        return;
      }
      payload.volume_number = parsedVolumeNumber ?? undefined;
    }

    if (Object.keys(payload).length === 0 && !coverFile) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      setUploadingCover(Boolean(coverFile));

      if (coverFile) {
        payload.cover_url = await uploadCover(user.id, book.id, coverFile);
      }

      await updateBook(book.id, payload);
      clearCoverDraft();
      reset(values);
      setIsEditMode(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
      setUploadingCover(false);
    }
  }

  async function handleDelete() {
    if (!book) return;
    try {
      setErrorMsg(null);
      await deleteBook(book.id);
      navigate("/library", { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete book");
    }
  }

  function openAttachmentPicker() {
    setSendAttachmentOpen(true);
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

  const quoteJournalEntries = useMemo(
    () =>
      sortJournalEntries(
        bookJournalToJournalEntries(journalEntries.filter((note) => note.label === "quote")).map((entry) => ({
          ...entry,
          relatedBookTitle: book?.title,
        })),
      ),
    [book?.title, journalEntries],
  );
  const thoughtJournalEntries = useMemo(
    () =>
      sortJournalEntries(
        bookJournalToJournalEntries(journalEntries.filter((note) => note.label === "note" || note.label === "review"))
          .map((entry) => ({ ...entry, relatedBookTitle: book?.title }))
          .filter(isThoughtJournalEntry),
      ),
    [book?.title, journalEntries],
  );
  const previewJournalEntries = useMemo(
    () =>
      sortJournalEntries([
        ...quoteJournalEntries,
        ...thoughtJournalEntries,
      ]).slice(0, 4),
    [quoteJournalEntries, thoughtJournalEntries],
  );

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
        <BackButton fallbackTo="/library" />
      </div>
    );
  }

  if (isEditMode) {
    return (
      <div className="space-y-6">
        <BackButton fallbackTo="/library" />

        {errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <EditDetailsForm
          bookTitle={book.title}
          coverUrl={book.cover_url}
          coverPreviewUrl={coverPreviewUrl}
          control={control}
          register={register}
          handleSubmit={handleSubmit}
          onSubmit={onSubmit}
          onCancel={exitEditMode}
          saving={saving}
          isDirty={isDirty}
          hasStagedCover={Boolean(coverFile)}
          errors={errors}
          series={series}
          watchedSeriesId={watchedSeriesId}
          publicationDatePrecision={publicationDatePrecision}
          updatePublicationDatePrecision={updatePublicationDatePrecision}
          clearPublicationDateError={() => clearErrors("publication_date")}
          uploadingCover={uploadingCover}
          handleCoverChange={handleCoverChange}
          onCreateAuthor={handleCreateAuthor}
        />
        {authorDialog}
      </div>
    );
  }

  const currentPage = book.current_page ?? 0;
  const totalPages = book.total_pages ?? 0;
  const isPaused = book.status === "Paused";
  const isReading = book.status === "Reading";
  const readingProgressStats: ProgressStat[] =
    isReading || isPaused
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
                  pausePeriods: book.pause_periods,
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
                  pausePeriods: book.pause_periods,
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
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <BackButton fallbackTo="/library" />

        <DetailActionsMenu
          kind="book"
          label={book.title}
          shareAttachmentLabel="Send the book as attachment in a chat"
          onPause={isReading ? () => void handlePause() : undefined}
          onResume={isPaused ? () => void handleResume() : undefined}
          onEdit={() => {
            setErrorMsg(null);
            setIsEditMode(true);
          }}
          onDelete={handleDelete}
          onSendAttachment={openAttachmentPicker}
          deleteTitle="Delete this book?"
          deleteDescription="Are you sure you want to delete this book? This cannot be undone."
        />
      </div>

      <section className="grid gap-6 md:grid-cols-[240px_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[240px]">
          <div
            className={cn(
              "relative block aspect-[2/3] overflow-hidden rounded-xl border bg-muted shadow-sm",
              isPaused && "opacity-70",
            )}
          >
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={book.title}
                className={cn("h-full w-full object-cover", isPaused && "grayscale")}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
            {isPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
                <PauseCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            {seriesName && (
              <p className="font-heading text-base italic leading-tight text-muted-foreground sm:text-lg">
                <Link
                  to={`/series/${book.series_id}`}
                  className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {seriesName}
                </Link>
                {book.volume_number != null ? ` #${book.volume_number}` : ""}
              </p>
            )}

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

            <p className="text-lg text-muted-foreground">
              {book.authors.map((author, index) => (
                <Fragment key={author}>
                  {index > 0 ? ", " : ""}
                  <Link
                    to={`/authors/${encodeURIComponent(findAuthorSummary(authorSummaries, author)?.id ?? author)}`}
                    className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {author}
                  </Link>
                </Fragment>
              ))}
            </p>

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
              {isPaused ? (
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
                  <PauseCircle className="h-3.5 w-3.5" />
                  Paused
                </Badge>
              ) : (
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
              )}
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
            {isPaused ? (
              <Button type="button" onClick={() => void handleResume()}>
                Resume
              </Button>
            ) : isReading ? (
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
              <Link to={`/books/${book.id}/journal?new=1`}>
                <NotebookPen className="mr-1.5 h-4 w-4" />
                Add entry
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {shareStatus && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
          {shareStatus}
        </div>
      )}

      <SendAttachmentDialog
        open={sendAttachmentOpen}
        onOpenChange={setSendAttachmentOpen}
        attachment={buildBookAttachment(book)}
        title={`Send "${book.title}" to chat`}
        description="Add a message, then pick the chat you want to send this book to."
        onSent={() => setShareStatus("Book sent to chat.")}
      />
      {authorDialog}

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
                  {linkedGenres.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {linkedGenres.map(({ genre, slug }) => (
                        <Badge key={genre.id} variant="outline" className="max-w-full font-normal" asChild>
                          <Link to={`/genres/${slug}`}>{genre.name}</Link>
                        </Badge>
                      ))}
                    </div>
                  ) : book.genre_paths?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {book.genre_paths.map((path) => (
                        <Badge key={path} variant="outline" className="max-w-full font-normal">
                          {formatGenrePathForDisplay(path)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not set</p>
                  )}
                </MetadataGroup>

                <div className="grid gap-4 sm:grid-cols-2">
                  <MetadataItem
                    label="Language"
                    value={
                      book.language ? (
                        <MetadataLink to={buildLibraryFilterPath("language", book.language)}>
                          {book.language}
                        </MetadataLink>
                      ) : (
                        "Not set"
                      )
                    }
                  />
                  <MetadataItem
                    label="Format"
                    value={
                      book.format ? (
                        <MetadataLink to={buildLibraryFilterPath("format", book.format)}>
                          {book.format}
                        </MetadataLink>
                      ) : (
                        "Not set"
                      )
                    }
                  />
                  <MetadataItem
                    label="Publication Date"
                    value={
                      publicationYear ? (
                        <MetadataLink to={buildLibraryFilterPath("publicationYear", publicationYear)}>
                          {formatPublicationDateForDisplay(
                            book.publication_date,
                            book.publication_date_precision,
                          )}
                        </MetadataLink>
                      ) : (
                        formatPublicationDateForDisplay(
                          book.publication_date,
                          book.publication_date_precision,
                        )
                      )
                    }
                  />
                  <MetadataItem
                    label="Publisher"
                    value={
                      book.publisher ? (
                        <MetadataLink to={buildLibraryFilterPath("publisher", book.publisher)}>
                          {book.publisher}
                        </MetadataLink>
                      ) : (
                        "Not set"
                      )
                    }
                  />
                  <MetadataItem
                    label="Source"
                    value={
                      book.source ? (
                        <MetadataLink to={buildLibraryFilterPath("source", book.source)}>
                          {book.source}
                        </MetadataLink>
                      ) : (
                        "Not set"
                      )
                    }
                  />
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
                  <ProgressOverTimeChart
                    logs={readingLogs}
                    totalPages={book.total_pages}
                    pausePeriods={book.pause_periods}
                  />
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-heading leading-snug font-medium">
                <span className="font-serif italic">Journal</span>
              </h2>
              <Button asChild variant="link" className="px-0">
                <Link to={`/books/${book.id}/journal`} className="text-primary">
                  Open journal
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {journalEntriesLoading || logsLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-40 animate-pulse rounded-lg bg-muted" />
                <div className="h-40 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : journalEntriesError ? (
              <p className="text-sm text-destructive">{journalEntriesError}</p>
            ) : logsError ? (
              <p className="text-sm text-destructive">{logsError}</p>
            ) : (
              previewJournalEntries.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  No journal entries yet.
                </div>
              ) : (
                <JournalTimeline
                  entries={previewJournalEntries}
                  layout="cards"
                  previewMode={{
                    getEntryHref: (entry) => `/books/${book.id}/journal?entry=${encodeURIComponent(entry.sourceId)}`,
                  }}
                  emptyMessage="No journal entries yet."
                  onEntryUpdated={(entry) => {
                    if (entry.source !== "book_note") return;
                    setJournalEntries((current) => sortBookJournalEntryRecords([entry.bookJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
                  }}
                  onEntryDeleted={(entry) => {
                    setJournalEntries((current) => current.filter((note) => note.id !== entry.sourceId));
                  }}
                />
              )
            )}
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
                  exploreGenre ? (
                    <>
                      More in <span className="font-serif italic">{exploreGenre}</span>
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

function MetadataLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

function MetadataItem({ label, value }: { label: string; value: ReactNode }) {
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
            <Link
              key={book.id}
              to={`/books/${book.id}`}
              className="group min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EditDetailsForm({
  bookTitle,
  coverUrl,
  coverPreviewUrl,
  control,
  register,
  handleSubmit,
  onSubmit,
  onCancel,
  saving,
  isDirty,
  hasStagedCover,
  errors,
  series,
  watchedSeriesId,
  publicationDatePrecision,
  updatePublicationDatePrecision,
  clearPublicationDateError,
  uploadingCover,
  handleCoverChange,
  onCreateAuthor,
}: {
  bookTitle: string;
  coverUrl?: string | null;
  coverPreviewUrl?: string | null;
  control: ReturnType<typeof useForm<FormValues>>["control"];
  register: ReturnType<typeof useForm<FormValues>>["register"];
  handleSubmit: ReturnType<typeof useForm<FormValues>>["handleSubmit"];
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  isDirty: boolean;
  hasStagedCover: boolean;
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
  series: { id: string; name: string }[];
  watchedSeriesId: string;
  publicationDatePrecision: PublicationDatePrecision | "";
  updatePublicationDatePrecision: (precision: PublicationDatePrecision | "") => void;
  clearPublicationDateError: () => void;
  uploadingCover: boolean;
  handleCoverChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onCreateAuthor: (initialName: string) => void;
}) {
  const activeCoverUrl = coverPreviewUrl ?? coverUrl;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border bg-card p-5 pb-28 md:pb-24">
      <div className="grid gap-5 md:grid-cols-[7.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1fr)]">
        <div className="md:row-span-3 md:self-start">
          <label
            htmlFor="cover-change"
            className="group relative block w-[min(7rem,38vw)] aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border bg-muted shadow-sm sm:w-28 md:w-full"
          >
            {activeCoverUrl ? (
              <img src={activeCoverUrl} alt={bookTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImagePlus className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
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
              onChange={handleCoverChange}
              disabled={saving || uploadingCover}
            />
          </label>
          {coverPreviewUrl && <p className="mt-2 text-xs text-muted-foreground">New cover staged for save.</p>}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="detail-title">Title</Label>
            <Input id="detail-title" {...register("title", { required: true })} />
          </div>

          <div className="space-y-1.5">
            <Label>Authors</Label>
            <Controller
              name="authors"
              control={control}
              rules={{
                validate: (value) => (value?.length ?? 0) > 0 || "At least one author is required",
              }}
              render={({ field }) => (
                <AuthorMultiSelect
                  value={field.value ?? []}
                  onChange={field.onChange}
                  onCreateNew={onCreateAuthor}
                />
              )}
            />
            {errors.authors && <p className="text-xs text-destructive">{errors.authors.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Genres</Label>
            <Controller
              name="genres"
              control={control}
              render={({ field }) => <GenreMultiSelect value={field.value ?? []} onChange={field.onChange} />}
            />
          </div>
        </div>

        <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
          <SelectField control={control} name="language" label="Language" options={["German", "Spanish", "English"]} />
          <SelectField control={control} name="format" label="Format" options={["eBook", "Audiobook", "Paperback", "Hardcover"]} />
          <SelectField control={control} name="source" label="Source" options={SOURCE_OPTIONS} />
          <div className="space-y-1.5">
            <Label htmlFor="detail-total-pages">Total pages</Label>
            <Input id="detail-total-pages" type="number" min={1} {...register("total_pages")} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="detail-publisher">Publisher</Label>
            <Input id="detail-publisher" {...register("publisher")} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="detail-publication-date">Publication date</Label>
            <Input
              id="detail-publication-date"
              placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
              aria-invalid={!!errors.publication_date}
              {...register("publication_date", { onChange: clearPublicationDateError })}
            />
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={!!publicationDatePrecision}
                  onChange={(event) => updatePublicationDatePrecision(event.target.checked ? "year" : "")}
                />
                Year
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={publicationDatePrecision === "month" || publicationDatePrecision === "day"}
                  onChange={(event) => updatePublicationDatePrecision(event.target.checked ? "month" : "year")}
                />
                Month
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={publicationDatePrecision === "day"}
                  onChange={(event) => updatePublicationDatePrecision(event.target.checked ? "day" : "month")}
                />
                Day
              </label>
            </div>
            {errors.publication_date && <p className="text-xs text-destructive">{errors.publication_date.message}</p>}
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
              <Input id="detail-volume-number" type="number" min={0.01} step="0.01" {...register("volume_number")} />
              {errors.volume_number && (
                <p className="text-xs text-destructive">{errors.volume_number.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="detail-isbn">ISBN</Label>
            <Input id="detail-isbn" inputMode="numeric" autoComplete="off" {...register("isbn")} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="detail-description">Description</Label>
            <Textarea id="detail-description" rows={6} {...register("description")} />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[4.25rem] z-50 border-t bg-card/95 px-5 py-4 shadow-[0_-8px_24px_oklch(0.21_0_0_/_0.08)] backdrop-blur supports-[backdrop-filter]:bg-card/85 md:bottom-0 md:px-10 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving || (!isDirty && !hasStagedCover)}>
            {saving ? "Saving..." : "Save Changes"}
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
