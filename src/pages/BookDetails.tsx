import LoadingIndicator from "@/components/LoadingIndicator";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  Clock,
  Heart,
  ImagePlus,
  Info,
  NotebookPen,
  PauseCircle,
  RefreshCw,
  Star,
  TrendingUp,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import AddAuthorDialog from "@/components/AddAuthorDialog";
import AuthorMultiSelect from "@/components/AuthorMultiSelect";
import BackButton from "@/components/BackButton";
import SaveCancelBar from "@/components/SaveCancelBar";
import { AboutSection, AppHeading } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import DuplicateOptionsDialog, { resolveDuplicateOptions, type DuplicateOptions } from "@/components/DuplicateOptionsDialog";
import GenreMultiSelect from "@/components/GenreMultiSelect";
import JournalTimeline from "@/components/JournalTimeline";
import {
  buildBookLibraryFilterPath,
  MetadataLink,
} from "@/components/LinkedMetadata";
import ProgressOverTimeChart from "@/components/ProgressOverTimeChart";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookCover } from "@/components/reading-journal/BookCover";
import { BookProgress, getBookProgress } from "@/components/reading-journal/BookProgress";
import "@/components/redesign/book-details.css";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { useAuth, useUserSettings } from "@/context";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import {
  formatCalendarSpan,
  formatPagesPerHour,
  formatTotalReadingTime,
  getCalendarPagesPerDay,
  getEstimatedFinish,
  getPagesPerHour,
  getReadingDuration,
  sumReadingMinutes,
} from "@/lib/bookAnalytics";
import { fetchBookJournalEntryRecords, sortBookJournalEntryRecords } from "@/lib/bookJournal";
import { fetchReadingLogsForBook, uploadCover } from "@/lib/books";
import { duplicateBookRecord } from "@/lib/duplication";
import { DEFAULT_LIBRARY_SETTINGS } from "@/lib/userSettings";
import { moveBookToWishlist } from "@/lib/wishlist";
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
} from "@/lib/publicationDate";
import { parseVolumeNumberInput } from "@/lib/volumeNumbers";
import {
  getTodayLocalDate,
} from "@/lib/utils";
import type {
  Book,
  BookFormat,
  BookLanguage,
  BookJournalEntryRecord,
  BookSource,
  BookStatus,
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
  publication_date: string;
  description: string;
  date_started: string;
  date_finished: string;
  series_id: string;
  volume_number: string;
  price: string;
  purchase_url: string;
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
    publication_date: formatPublicationDateInput(book.publication_date),
    description: book.description ?? "",
    date_started: book.date_started ?? "",
    date_finished: book.date_finished ?? "",
    series_id: book.series_id ?? "",
    volume_number: book.volume_number?.toString() ?? "",
    price: book.price?.toString() ?? "",
    purchase_url: book.purchase_url ?? "",
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

function getPublicationYear(value?: string | null): string | null {
  const [year] = (value ?? "").split("-");
  return year && /^\d{4}$/.test(year) ? year : null;
}

export default function BookDetails() {
  const { bookId } = useParams<{ bookId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { setDetailEditingOpen } = useOutletContext<AppLayoutOutletContext>();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const {
    books,
    wishlistBooks,
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
  const [removeCover, setRemoveCover] = useState(false);
  const coverPreviewUrlRef = useRef<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(false);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);
  const [sendAttachmentOpen, setSendAttachmentOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
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
    clearCoverDraft();
    reset(bookToFormValues(book));
  }, [book, reset]);

  useEffect(() => {
    if (!book || location.state?.openEdit !== true) return;
    setIsEditMode(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [book, location.pathname, location.state, navigate]);

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
  const progressPercent = book ? getBookProgress(book.current_page, book.total_pages) : null;
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

  const authorSummaries = useMemo(
    () => buildAuthorSummaries(authors, books, journalEntries, wishlistBooks),
    [authors, books, journalEntries, wishlistBooks],
  );

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
    setRemoveCover(false);
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
    setRemoveCover(false);
    const nextPreviewUrl = URL.createObjectURL(file);
    coverPreviewUrlRef.current = nextPreviewUrl;
    setCoverPreviewUrl(nextPreviewUrl);
    event.currentTarget.value = "";
  }

  function handleRemoveCover() {
    clearCoverDraft();
    setRemoveCover(Boolean(book?.cover_url));
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
    if (dirtyFields.status) {
      payload.status = values.status;
      // Match the status control in the read view without replacing dates entered below.
      if (values.status === "Reading" && !values.date_started) payload.date_started = getTodayLocalDate();
      if (values.status === "Finished" && !values.date_finished) payload.date_finished = getTodayLocalDate();
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
    if (dirtyFields.publication_date) {
      const parsedPublicationDate = parsePublicationDateInput(values.publication_date);
      if (values.publication_date.trim() && !parsedPublicationDate) {
        setError("publication_date", {
          message: "Use a four-digit year, like 2020.",
        });
        return;
      }
      payload.publication_date = parsedPublicationDate?.date ?? null;
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

    if (values.status === "Wishlist" && dirtyFields.price) {
      const price = values.price.trim() ? Number(values.price) : null;
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        setError("price", { message: "Enter a non-negative price." });
        return;
      }
      payload.price = price;
    }
    if (values.status === "Wishlist" && dirtyFields.purchase_url) {
      const url = values.purchase_url.trim();
      if (url) {
        try {
          if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
        } catch {
          setError("purchase_url", { message: "Enter a valid web link, including https://." });
          return;
        }
      }
      payload.purchase_url = url || null;
    }

    if (Object.keys(payload).length === 0 && !coverFile && !removeCover) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      setUploadingCover(Boolean(coverFile));

      if (coverFile) {
        payload.cover_url = await uploadCover(user.id, crypto.randomUUID(), coverFile);
      } else if (removeCover) {
        payload.cover_url = null;
      }

      await updateBook(book.id, payload);
      clearCoverDraft();
      reset(values);
      setIsEditMode(false);
      if (values.status === "Wishlist") navigate("/library/wishlist");
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
      const message = err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to delete book";
      setErrorMsg(message);
    }
  }

  function openAttachmentPicker() {
    setSendAttachmentOpen(true);
  }

  async function duplicateCurrentBook(options: DuplicateOptions) {
    if (!book || !user) return;
    try {
      setErrorMsg(null);
      const duplicate = await duplicateBookRecord(book, user.id, options);
      setDuplicateOpen(false);
      await reload();
      navigate(`/books/${duplicate.id}`, { state: { openEdit: true } });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to duplicate book");
    }
  }

  function openDuplicateDialog() {
    if (!book || !user) return;
    const library = settings?.library ?? DEFAULT_LIBRARY_SETTINGS;
    const resolved = resolveDuplicateOptions("book", library.duplicate_journal_entries, library.duplicate_books);
    if (resolved.needsDialog) {
      setDuplicateOpen(true);
      return;
    }
    void duplicateCurrentBook(resolved.options);
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
  const visibleJournalEntries = useMemo(
    () =>
      sortJournalEntries([
        ...quoteJournalEntries,
        ...thoughtJournalEntries,
      ]),
    [quoteJournalEntries, thoughtJournalEntries],
  );

  if (loading) {
    return (
      <LoadingIndicator variant="page" />
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
        <AppHeading level={1} as="h1">Book not found</AppHeading>
        <p className="max-w-md text-sm text-muted-foreground">
          This book may not exist, may have been deleted, or you may not have access.
        </p>
        <BackButton
          fallbackTo="/library"
          className="hover:bg-transparent hover:text-foreground/80"
        />
      </div>
    );
  }

  if (isEditMode) {
    return (
      <div className="rj-detail-page space-y-6">
        <BackButton
          fallbackTo="/library"
          className="relative z-10 rounded-full bg-transparent hover:bg-background/20 hover:text-foreground"
          onClick={exitEditMode}
        />

        <div className="relative z-10 space-y-2">
          <AppHeading level={1} as="h1">Edit book</AppHeading>
          <p className="text-sm text-muted-foreground">Update the book details shown in your library.</p>
        </div>

        {errorMsg && (
          <div className="relative z-10 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="relative z-10">
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
            hasCoverRemoval={removeCover}
            errors={errors}
            series={series}
            watchedSeriesId={watchedSeriesId}
            clearPublicationDateError={() => clearErrors("publication_date")}
            uploadingCover={uploadingCover}
            handleCoverChange={handleCoverChange}
            onRemoveCover={handleRemoveCover}
            onCreateAuthor={handleCreateAuthor}
          />
        </div>
        {authorDialog}
      </div>
    );
  }

  const currentPage = book.current_page ?? 0;
  const totalPages = book.total_pages ?? 0;
  const isPaused = book.status === "Paused";
  const isReading = book.status === "Reading";
  const readingActionLabel = book.status === "Finished" ? "Reread" : "Start Reading";
  const hasSecondaryMetadata = Boolean(book.format || book.language || publicationYear || book.source || book.isbn);
  const hasReadingLogs = readingLogs.length > 0;
  // Only use date-based stats after a successful fetch confirms there are no logs.
  const hasNoReadingLogs = !logsLoading && !logsError && !hasReadingLogs;
  const hasStartedReading = isReading || isPaused || book.status === "Finished" || book.status === "DNF";
  const useDateBasedStats = hasNoReadingLogs && hasStartedReading;
  const calendarPagesPerDay = useDateBasedStats
    ? getCalendarPagesPerDay({
        pages: book.status === "Finished" ? totalPages : currentPage,
        dateStarted: book.date_started,
        dateEnded: book.date_finished,
        pausePeriods: book.pause_periods,
      })
    : null;
  const calendarPaceLabel = calendarPagesPerDay === null
    ? "Not available"
    : `${calendarPagesPerDay.toFixed(1)} pages/day`;
  const readingTimeStat: ProgressStat = {
    icon: Clock,
    label: useDateBasedStats
      ? "Total Reading Duration"
      : book.status === "Finished" ? "Total Reading Time" : "Time Reading",
    value: useDateBasedStats ? daysReading : formatTotalReadingTime(totalReadingMinutes),
  };
  const readingPaceStat: ProgressStat = {
    icon: TrendingUp,
    label: useDateBasedStats
      ? "Reading Pace"
      : book.status === "Finished" ? "Average Speed" : "Current Speed",
    value: useDateBasedStats
      ? calendarPaceLabel
      : formatPagesPerHour(
          getPagesPerHour({
            pages: book.status === "Finished" ? totalPages : currentPage,
            readingMinutes: totalReadingMinutes,
          }),
        ),
  };
  const readingProgressStats: ProgressStat[] =
    isReading
      ? [
          {
            icon: Calendar,
            label: "Started On",
            value: formatDateForDisplay(book.date_started),
          },
          {
            icon: CalendarClock,
            label: "Estimated Finish",
            value:
              estimatedFinish.isAvailable && estimatedFinish.finishDate
                ? formatDateObjectForDisplay(estimatedFinish.finishDate)
                : "Not available",
          },
          readingTimeStat,
          readingPaceStat,
        ]
      : isPaused
        ? [
            {
              icon: Calendar,
              label: "Started On",
              value: formatDateForDisplay(book.date_started),
            },
            readingPaceStat,
            readingTimeStat,
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
            readingTimeStat,
            readingPaceStat,
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
            readingTimeStat,
            useDateBasedStats ? readingPaceStat : {
              icon: Calendar,
              label: "Days Reading",
              value: daysReading,
            },
          ];
  const summaryStats: ProgressStat[] = [];
  if (book.date_finished) {
    summaryStats.push({ icon: CalendarCheck, label: "Finished on", value: formatDateForDisplay(book.date_finished) });
  } else if (book.date_started) {
    summaryStats.push({ icon: Calendar, label: "Started on", value: formatDateForDisplay(book.date_started) });
  }
  if (totalReadingMinutes > 0) {
    summaryStats.push({ icon: Clock, label: "Reading time", value: formatTotalReadingTime(totalReadingMinutes) });
  }
  const description = book.description?.trim() || "";
  return (
    <div className="rj-detail-page">
      <section className="rj-detail-hero" aria-labelledby="book-detail-title">
        <div className="rj-detail-cover-stage">
          <div className="rj-detail-topline">
            <BackButton fallbackTo="/library" className="min-h-11 min-w-11" />
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
              onDuplicate={openDuplicateDialog}
              onWishlist={() => {
                if (!confirm("Move this book to your wishlist? It will leave your library, but its journal and reading data will be kept.")) return;
                void moveBookToWishlist(book).then(async () => {
                  await reload();
                  navigate("/library/wishlist");
                }).catch((err) => setErrorMsg(err instanceof Error ? err.message : "Could not move to wishlist"));
              }}
              onDelete={handleDelete}
              onSendAttachment={openAttachmentPicker}
              deleteTitle="Delete this book?"
              deleteDescription="Are you sure you want to delete this book? This cannot be undone."
              buttonClassName="size-11 hover:bg-background/30 aria-expanded:bg-background/30"
            />
          </div>
          <BookCover
            className="rj-detail-cover"
            imageClassName="object-top"
            src={book.cover_url}
            title={book.title}
            paused={isPaused}
            showFallbackTitle
          />
        </div>

        <div className="rj-detail-summary">
          <div>
            {seriesName && (
              <p className="mb-2 break-words font-heading text-sm italic text-muted-foreground sm:text-base">
                <Link
                  to={`/series/${book.series_id}`}
                  className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {seriesName}
                </Link>
                {book.volume_number != null ? ` #${book.volume_number}` : ""}
              </p>
            )}

            <div className="rj-detail-title-row">
              <h1 id="book-detail-title">{book.title}</h1>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={toggleFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={isFavorite}
              >
                <Heart className={isFavorite ? "fill-favorite text-favorite" : undefined} />
              </Button>
            </div>

            <p className="rj-detail-author break-words">
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

            <div className="rj-detail-status-row relative">
              <div>
                {isPaused ? (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
                    <PauseCircle className="h-3.5 w-3.5" />
                    Paused
                  </Badge>
                ) : (
                  <select
                    aria-label="Reading status"
                    className="min-h-11 rounded-xl border border-input bg-surface px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    value={book.status}
                    onChange={(event) => void handleStatusChange(event.currentTarget.value as BookStatus)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="rj-detail-rating">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleRating(n)}
                      aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                      aria-pressed={localRating === n}
                      className="grid size-7 place-items-center rounded transition-transform hover:scale-110"
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
                <div className="flex items-center">
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
                      className="absolute left-0 top-full z-20 mt-2 w-72 max-w-full rounded-lg border bg-popover p-3 text-xs text-muted-foreground shadow-sm"
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
            </div>
          </div>

          <div className="rj-detail-position">
            <p>{currentPage}{totalPages > 0 ? ` / ${totalPages}` : ""} pages</p>
            {progressPercent !== null && <span>{progressPercent}%</span>}
          </div>
          <BookProgress currentPage={currentPage} totalPages={book.total_pages} />

          <div className="rj-detail-actions">
            {isPaused ? (
              <Button type="button" onClick={() => void handleResume()}>
                <BookOpen aria-hidden="true" />
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
                trigger={<Button type="button"><BookOpen aria-hidden="true" />Update Progress</Button>}
              />
            ) : (
              <Button
                type="button"
                onClick={async () => {
                  await handleStatusChange("Reading");
                  setIsProgressDialogOpen(true);
                }}
              >
                <BookOpen aria-hidden="true" />
                {readingActionLabel}
              </Button>
            )}
            <Button asChild type="button" variant="outline">
              <Link to={`/books/${book.id}/journal?new=1`}>
                <NotebookPen aria-hidden="true" />
                Add entry
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="rj-detail-notice text-sm text-destructive" role="alert">
          {errorMsg}
        </div>
      )}

      {shareStatus && (
        <div className="rj-detail-notice text-sm" role="status">
          {shareStatus}
        </div>
      )}

      <SendAttachmentDialog
        open={sendAttachmentOpen}
        onOpenChange={setSendAttachmentOpen}
        attachment={buildBookAttachment(book, journalEntries, authors)}
        title={`Send "${book.title}" to chat`}
        description="Add a message, then pick the chat you want to send this book to."
        onSent={() => setShareStatus("Book sent to chat.")}
      />
      <DuplicateOptionsDialog
        open={duplicateOpen}
        kind="book"
        journalPreference={(settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_journal_entries}
        booksPreference={(settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_books}
        onOpenChange={setDuplicateOpen}
        onConfirm={duplicateCurrentBook}
      />
      {authorDialog}

      <div className="rj-detail-body">
        <div>
          <AboutSection
            className="rj-detail-description"
            title="About this book"
            text={description}
            titleContent={
              <div className="rj-detail-tags">
                {linkedGenres.length > 0
                  ? linkedGenres.map(({ genre, slug }) => (
                      <Link key={genre.id} to={`/genres/${slug}`}>{genre.name}</Link>
                    ))
                  : book.genre_paths?.map((path) => (
                      <span key={path}>{formatGenrePathForDisplay(path)}</span>
                    ))}
              </div>
            }
          />
          {hasSecondaryMetadata && (
            <details className="rj-detail-metadata">
              <summary>More book details</summary>
              <dl>
                {book.format && (
                  <SecondaryMetadataRow label="Format" value={
                    <MetadataLink to={buildBookLibraryFilterPath("format", book.format)}>{book.format}</MetadataLink>
                  } />
                )}
                {book.language && (
                  <SecondaryMetadataRow label="Language" value={
                    <MetadataLink to={buildBookLibraryFilterPath("language", book.language)}>{book.language}</MetadataLink>
                  } />
                )}
                {book.source && (
                  <SecondaryMetadataRow label="Source" value={
                    <MetadataLink to={buildBookLibraryFilterPath("source", book.source)}>{book.source}</MetadataLink>
                  } />
                )}
                {publicationYear && (
                  <SecondaryMetadataRow label="Publication Date" value={
                    <MetadataLink to={buildBookLibraryFilterPath("publicationYear", publicationYear)}>
                      {formatPublicationDateForDisplay(book.publication_date)}
                    </MetadataLink>
                  } />
                )}
                {book.isbn && <SecondaryMetadataRow label="ISBN" value={book.isbn} />}
              </dl>
            </details>
          )}
        </div>

        <section aria-labelledby="book-detail-progress">
          <div className="rj-detail-section-heading">
            <h2 id="book-detail-progress">Reading Progress</h2>
            {!logsLoading && !logsError && hasReadingLogs && (
              <Button asChild variant="ghost">
                <Link to={`/books/${book.id}/analytics`} aria-label="View more reading analytics">
                  View more <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>

          {logsLoading ? (
            <LoadingIndicator label="Loading reading progress…" />
          ) : logsError ? (
            <p className="text-sm text-destructive" role="alert">{logsError}</p>
          ) : (
            <>
              {summaryStats.length > 0 ? (
                <dl className="rj-detail-stats">
                  {summaryStats.map(({ icon: Icon, label, value }) => (
                    <div key={label}>
                      <dt><Icon aria-hidden="true" />{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="rj-detail-quiet">Your reading sessions will appear here.</p>
              )}
              {(hasStartedReading || hasReadingLogs || book.date_started || book.date_finished || currentPage > 0) && (
                <details className="rj-detail-metadata">
                  <summary>More reading stats</summary>
                  <ProgressStatsStrip stats={readingProgressStats} />
                  {hasReadingLogs && (
                    <div className="my-4 space-y-3">
                      <h3 className="text-sm font-medium">Progress over time</h3>
                      <ProgressOverTimeChart
                        logs={readingLogs}
                        totalPages={book.total_pages}
                        pausePeriods={book.pause_periods}
                      />
                    </div>
                  )}
                </details>
              )}
            </>
          )}
        </section>

        <section className="rj-detail-journal" aria-labelledby="book-detail-journal">
          <div className="rj-detail-section-heading">
            <h2 id="book-detail-journal">Journal</h2>
            <Button asChild variant="ghost">
              <Link to={`/books/${book.id}/journal`}>
                Open journal <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {journalEntriesLoading ? (
            <LoadingIndicator label="Loading journal entries…" />
          ) : journalEntriesError ? (
            <p className="text-sm text-destructive" role="alert">{journalEntriesError}</p>
          ) : visibleJournalEntries.length > 0 ? (
            <>
              <JournalTimeline
                entries={visibleJournalEntries.slice(0, 1)}
                layout="cards"
                className="rj-detail-journal-preview"
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
              {visibleJournalEntries.length > 1 && (
                <p className="rj-detail-entry-count">{visibleJournalEntries.length} journal entries</p>
              )}
            </>
          ) : (
            <div className="rj-detail-empty">
              <NotebookPen aria-hidden="true" />
              <p>A place for your thoughts</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to={`/books/${book.id}/journal?new=1`}>Write your first entry</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
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

function SecondaryMetadataRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
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
  hasCoverRemoval,
  errors,
  series,
  watchedSeriesId,
  clearPublicationDateError,
  uploadingCover,
  handleCoverChange,
  onRemoveCover,
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
  hasCoverRemoval: boolean;
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
  series: { id: string; name: string; is_wishlist_only?: boolean }[];
  watchedSeriesId: string;
  clearPublicationDateError: () => void;
  uploadingCover: boolean;
  handleCoverChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveCover: () => void;
  onCreateAuthor: (initialName: string) => void;
}) {
  const activeCoverUrl = coverPreviewUrl ?? (hasCoverRemoval ? null : coverUrl);

  const [secondaryInformationOpen, setSecondaryInformationOpen] = useState(false);
  const status = useWatch({ control, name: "status" });

  useEffect(() => {
    if (errors.publication_date || errors.price || errors.purchase_url) setSecondaryInformationOpen(true);
  }, [errors.publication_date, errors.price, errors.purchase_url]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border bg-card p-5 pb-28 md:pb-24">
      <div className="grid gap-5 md:grid-cols-[7.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1fr)]">
        <div className="md:row-span-3 md:self-start">
          <label
            htmlFor="cover-change"
            className="group relative block w-[min(7rem,38vw)] aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border bg-muted shadow-sm sm:w-28 md:w-full"
          >
            {activeCoverUrl ? (
              <img src={activeCoverUrl} alt={bookTitle} className="block h-full w-full object-cover object-top" />
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
          {activeCoverUrl && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-1 h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Remove cover"
              disabled={saving || uploadingCover}
              onClick={onRemoveCover}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
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
          <div className="space-y-1.5">
            <Label htmlFor="detail-status">Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={saving}>
                  <SelectTrigger id="detail-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Wishlist", ...STATUS_OPTIONS, ...(field.value === "Paused" ? ["Paused"] : [])].map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <SelectField control={control} name="language" label="Language" options={["German", "Spanish", "English"]} />
          <div className="space-y-1.5">
            <Label htmlFor="detail-total-pages">Total pages</Label>
            <Input id="detail-total-pages" type="number" min={1} {...register("total_pages")} />
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
                    {series.filter((item) => !item.is_wishlist_only || item.id === watchedSeriesId).map((item) => (
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
            <div className="space-y-1.5 sm:max-w-[10rem]">
              <Label htmlFor="detail-volume-number">Volume number</Label>
              <Input id="detail-volume-number" type="number" min={0.01} step="0.01" {...register("volume_number")} />
              {errors.volume_number && (
                <p className="text-xs text-destructive">{errors.volume_number.message}</p>
              )}
            </div>
          )}

          <div className="space-y-3 sm:col-span-2">
            <button
              type="button"
              className="flex items-center gap-1.5 text-base font-medium text-foreground transition-colors hover:text-primary"
              onClick={() => setSecondaryInformationOpen((current) => !current)}
              aria-expanded={secondaryInformationOpen}
              aria-controls="detail-secondary-information"
            >
              <ChevronRight className={`h-[1.125rem] w-[1.125rem] transition-transform ${secondaryInformationOpen ? "rotate-90" : ""}`} aria-hidden="true" />
              Secondary Information
            </button>
            {secondaryInformationOpen && (
              <div id="detail-secondary-information" className="grid gap-4 sm:grid-cols-2">

                <div className="space-y-1.5">
                  <Label htmlFor="detail-publication-date">Publication year</Label>
                  <Input
                    id="detail-publication-date"
                    placeholder="YYYY"
                    inputMode="numeric"
                    maxLength={4}
                    aria-invalid={!!errors.publication_date}
                    {...register("publication_date", { onChange: clearPublicationDateError })}
                  />
                  {errors.publication_date && <p className="text-xs text-destructive">{errors.publication_date.message}</p>}
                </div>

                <SelectField control={control} name="format" label="Format" options={["eBook", "Audiobook", "Paperback", "Hardcover"]} />

                <SelectField control={control} name="source" label="Source" options={SOURCE_OPTIONS} />

                <div className="space-y-1.5">
                  <Label htmlFor="detail-isbn">ISBN</Label>
                  <Input id="detail-isbn" inputMode="numeric" autoComplete="off" {...register("isbn")} />
                </div>
                {status === "Wishlist" && <>
                  <div className="space-y-1.5">
                    <Label htmlFor="detail-price">Price</Label>
                    <Input id="detail-price" type="number" min="0" step="0.01" {...register("price")} />
                    {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="detail-purchase-url">Purchase link</Label>
                    <Input id="detail-purchase-url" type="url" {...register("purchase_url")} />
                    {errors.purchase_url && <p className="text-xs text-destructive">{errors.purchase_url.message}</p>}
                  </div>
                </>}
              </div>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="detail-description">Description</Label>
            <Textarea id="detail-description" rows={6} {...register("description")} />
          </div>
        </div>
      </div>

      <SaveCancelBar
        onCancel={onCancel}
        saving={saving}
        saveDisabled={!isDirty && !hasStagedCover && !hasCoverRemoval}
        saveLabel="Save Changes"
        savingLabel="Saving..."
      />
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
