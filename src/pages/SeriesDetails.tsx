import LoadingIndicator from "@/components/LoadingIndicator";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  Flag,
  ImagePlus,
  Loader2,
  NotebookPen,
  Star,
  Trash2,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import SaveCancelBar from "@/components/SaveCancelBar";
import { AboutSection, AppHeading } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import DuplicateOptionsDialog, { resolveDuplicateOptions, type DuplicateOptions } from "@/components/DuplicateOptionsDialog";
import { BookCover } from "@/components/reading-journal/BookCover";
import { BookDetailTitle } from "@/components/redesign/BookDetailTitle";
import { DetailGenreTags, DetailHero, DetailStat } from "@/components/redesign/DetailHero";
import { DetailBooks } from "@/components/redesign/DetailBooks";
import { DetailJournal, useDetailJournalEditor, useDetailJournalEntries } from "@/components/redesign/DetailJournal";
import { DetailBack, DetailSheet } from "@/components/redesign/DetailSheet";
import { ReadingStat, StatRow } from "@/components/redesign/ReadingStat";
import {
  buildAuthorDetailPath,
  MetadataLink,
} from "@/components/LinkedMetadata";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { SeriesReadingTotals, SeriesAnalyticsComparison } from "@/components/series/SeriesAnalyticsSections";
import { BookHighlights } from "@/components/redesign/BookHighlights";
import SeriesBooksEditor, {
  buildEditableSeriesBooks,
  parseVolumeInput,
  type EditableSeriesBook,
} from "@/components/series/SeriesBooksEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useUserSettings } from "@/context";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import { useDetailSectionAnchor } from "@/hooks/useDetailSectionAnchor";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import { parseLocalDateOnly } from "@/lib/bookAnalytics";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import { deleteSeriesBanner, fetchReadingLogs, uploadSeriesBanner } from "@/lib/books";
import { duplicateSeriesRecord } from "@/lib/duplication";
import { buildSeriesAttachment } from "@/lib/chatAttachments";
import { buildGenreSlugLookup } from "@/lib/genreTree";
import { formatMediumDate } from "@/lib/dateDisplay";
import {
  filterSeriesLogs,
  estimateSeriesCompletionDate,
  getAverageSeriesRating,
  getCurrentSeriesBook,
  getDerivedSeriesStatus,
  getJourneyBookDates,
  getSeriesAuthors,
  getSeriesGenres,
  getSeriesProgress,
  getSeriesStats,
  sortSeriesBooks,
  type SeriesStats,
} from "@/lib/seriesDetails";
import { fetchSeriesJournalEntryRecords } from "@/lib/seriesJournal";
import { seriesJournalToJournalEntries } from "@/lib/journal";
import { getTodayLocalDate } from "@/lib/utils";
import { DEFAULT_LIBRARY_SETTINGS } from "@/lib/userSettings";
import type { AuthorJournalEntryRecord, Book, BookJournalEntryRecord, ReadingLog, Series, SeriesJournalEntryRecord } from "@/types";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

function formatDate(value: string | null): string {
  const date = parseLocalDateOnly(value ?? undefined);
  return date ? formatMediumDate(date) : "Not available";
}

function getSeriesCompletionDates(books: Book[], logs: ReadingLog[]): { started: string | null; finished: string | null } {
  const dates = sortSeriesBooks(books).map((book) => getJourneyBookDates(book, logs));
  const finishedDates = dates.flatMap((date) => (date.finished ? [date.finished] : [])).sort();
  return {
    started: dates.flatMap((date) => (date.started ? [date.started] : [])).sort()[0] ?? null,
    finished: finishedDates[finishedDates.length - 1] ?? null,
  };
}

function SeriesArtwork({ banner, volume }: { banner?: string | null; volume?: Book }) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  if (banner && banner !== failedBanner) {
    return (
      <div className="rj-detail-banner">
        <img src={banner} alt="" className="size-full object-cover" onError={() => setFailedBanner(banner)} />
      </div>
    );
  }
  if (volume?.cover_url) {
    return <BookCover className="rj-detail-cover" src={volume.cover_url} title={volume.title} />;
  }
  return <div className="rj-detail-banner"><BookOpen aria-hidden="true" className="size-12" strokeWidth={1} /></div>;
}

function CircularSeriesProgress({ value }: { value: number | null }) {
  const percentage = value ?? 0;

  return (
    <div role="progressbar" aria-label="Series progress" aria-valuenow={value ?? undefined}
      className="rj-series-progress-ring relative flex aspect-square shrink-0 items-center justify-center rounded-full p-2 sm:p-3">
      <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 144 144" fill="none">
        <circle cx="72" cy="72" r="66" stroke="var(--muted)" strokeWidth="12" />
        {percentage > 0 && (
          <circle cx="72" cy="72" r="66" stroke="var(--ring)" strokeWidth="12" strokeLinecap="round"
            pathLength="100" strokeDasharray={percentage < 100 ? `${percentage} 100` : undefined} transform="rotate(-90 72 72)" />
        )}
      </svg>
      <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-center">
        <span className="rj-series-progress-percentage font-heading text-lg font-semibold italic sm:text-2xl">{value === null ? "--" : `${value}%`}</span>
      </div>
    </div>
  );
}

function FeaturedSeriesBook({ book }: { book: Book | null }) {
  if (!book) {
    return <p className="text-sm text-muted-foreground">No book available</p>;
  }

  return (
    <Link to={`/books/${encodeURIComponent(book.id)}`} className="rj-reading-card rj-series-progress-book">
      <BookCover src={book.cover_url} title={book.title} paused={book.status === "Paused"} decorative />
      <span className="rj-reading-card-copy">
        <span className="rj-book-title wrap-anywhere">{book.title}</span>
        {book.volume_number != null && <span className="rj-muted">Volume {book.volume_number}</span>}
      </span>
    </Link>
  );
}

type SeriesProgressDetail =
  | {
      kind: "active";
      book: Book | null;
      estimatedCompletion: string | null;
    }
  | {
      kind: "not-started";
      book: Book | null;
      onStartReading: () => void;
      startDisabled: boolean;
    }
  | {
      kind: "completed";
      started: string | null;
      finished: string | null;
    }
  | {
      kind: "hidden";
    };

function SeriesProgressCard({ percentage, stats, logsLoading, logsError, detail }: {
  percentage: number | null;
  stats: SeriesStats;
  logsLoading: boolean;
  logsError: string | null;
  detail: SeriesProgressDetail;
}) {
  const headingId = useId();
  const startedOn = detail.kind === "completed" ? formatDate(detail.started) : null;
  const finishedOn = detail.kind === "completed" ? formatDate(detail.finished) : null;
  const leadingStat = detail.kind === "active" ? (
    <dl><DetailStat icon={CalendarDays} label="Estimated Finish" value={formatDate(detail.estimatedCompletion)} /></dl>
  ) : startedOn && finishedOn ? (
    <ReadingStat icon={Calendar} label="Started on" value={startedOn} secondary={{ label: "Finished on", value: finishedOn }}>
      <dl className="space-y-2">
        <StatRow icon={Calendar} label="Started on" value={startedOn} />
        <StatRow icon={Flag} label="Finished on" value={finishedOn} />
      </dl>
    </ReadingStat>
  ) : undefined;
  return (
    <section aria-labelledby={headingId}>
      <div className="rj-detail-section-heading"><h2 id={headingId}>Reading progress</h2></div>
      <div className={detail.kind === "completed" ? "rj-series-progress-completed" : undefined}>
        <div className="flex items-center gap-3 sm:gap-5">
          <CircularSeriesProgress value={percentage} />
          {(detail.kind === "active" || detail.kind === "not-started") && (
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-sm font-semibold">{detail.kind === "active" ? "Current Book" : "First volume"}</p>
              <FeaturedSeriesBook book={detail.book} />
            </div>
          )}
        </div>
        <SeriesReadingTotals stats={stats} logsLoading={logsLoading} logsError={logsError} leadingStat={leadingStat} />
      </div>
    </section>
  );
}

function PageLoading() {
  return (
    <LoadingIndicator variant="page" />
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
      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 pb-24">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="series-banner">Banner image</Label>
              <label
                htmlFor="series-banner"
                className="group relative flex aspect-[16/7] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-primary/60"
              >
                {shownBannerUrl ? (
                  <img src={shownBannerUrl} alt="Series banner preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs">Click to upload</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <ImagePlus className="h-5 w-5 text-white" />
                </div>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    aria-label="Remove banner"
                    disabled={saving}
                    onClick={handleRemoveBanner}
                  >
                    <Trash2 className="h-4 w-4" />
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
              <AppHeading level={4} as="h2">Books in this series</AppHeading>
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

        <SaveCancelBar
          onCancel={onCancel}
          saving={saving}
          saveDisabled={!name.trim()}
          saveLabel="Save Series"
          savingLabel="Saving..."
        />
      </form>
    </div>
  );
}

const seriesDetailLabel = "Series details";
const seriesFallback = "/library/series";

export default function SeriesDetails() {
  const { seriesId } = useParams<{ seriesId: string }>();
  return (
    <DetailSheet key={seriesId} label={seriesDetailLabel} fallbackTo={seriesFallback}>
      {(close) => <SeriesDetailsContent seriesId={seriesId} onClose={close} />}
    </DetailSheet>
  );
}

function SeriesDetailsContent({ seriesId, onClose }: { seriesId?: string; onClose: () => void }) {
  const headingId = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const { user } = useAuth();
  const { authors: authorRecords } = useAuthorsContext();
  const {
    books,
    loading: booksLoading,
    error: booksError,
    updateBook,
    updateBookSeriesPlacement,
    updateBookVolumeNumber,
    reload: reloadBooks,
  } = useBooksContext();
  const { genres: availableGenres } = useGenresContext();
  const { series, loading: seriesLoading, error: seriesError, editSeries, removeSeries, reload: reloadSeries } = useSeries();
  const { settings } = useUserSettings();
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendAttachmentOpen, setSendAttachmentOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingSeries, setSavingSeries] = useState(false);
  const [startingBookId, setStartingBookId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const seriesRecord = series.find((item) => item.id === seriesId) ?? null;
  const insightsAnchored = location.hash === "#insights" || location.hash === "#analytics";
  const insightsRef = useDetailSectionAnchor(
    location.hash === "#analytics" ? "analytics" : "insights",
    !booksLoading && !seriesLoading && !isEditMode,
  );
  const seriesJournal = useDetailJournalEntries(seriesRecord?.id, fetchSeriesJournalEntryRecords, seriesJournalToJournalEntries);
  const saveJournalEntry = useCallback((record: AuthorJournalEntryRecord | BookJournalEntryRecord | SeriesJournalEntryRecord) => {
    if ("series_id" in record && record.series_id === seriesRecord?.id) seriesJournal.save(record);
  }, [seriesRecord?.id, seriesJournal.save]);
  const journalEditor = useDetailJournalEditor("Series", !booksLoading && !seriesLoading && !isEditMode && user ? seriesRecord?.id : undefined, saveJournalEntry);
  useEffect(() => {
    if (!seriesRecord || location.state?.openEdit !== true) return;
    setIsEditMode(true);
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null });
  }, [location, navigate, seriesRecord]);
  const seriesBooks = useMemo(
    () => sortSeriesBooks(books.filter((book) => book.series_id === seriesId)),
    [books, seriesId],
  );

  const featuredVolume = seriesBooks.find((book) => book.cover_url);
  const heroColor = useBookHeroColor(seriesRecord?.cover_url || featuredVolume?.cover_url);

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
  const genreSlugByName = useMemo(() => {
    const { slugById } = buildGenreSlugLookup(availableGenres);
    return new Map(
      availableGenres.map((genre) => [genre.name.toLocaleLowerCase(), slugById.get(genre.id) ?? genre.id]),
    );
  }, [availableGenres]);
  const averageRating = useMemo(() => getAverageSeriesRating(seriesBooks), [seriesBooks]);
  const currentBook = useMemo(() => getCurrentSeriesBook(seriesBooks), [seriesBooks]);
  const derivedStatus = useMemo(() => getDerivedSeriesStatus(seriesBooks), [seriesBooks]);
  const firstVolume = useMemo(() => sortSeriesBooks(seriesBooks)[0] ?? null, [seriesBooks]);
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
        started: completionDates.started,
        finished: completionDates.finished,
      };
    }

    if (derivedStatus === "Ongoing") {
      return {
        kind: "active",
        book: currentBook,
        estimatedCompletion,
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

  async function handleDeleteSeries(deleteLinkedBooks = false) {
    if (!seriesRecord) return;
    try {
      setActionError(null);
      await removeSeries(seriesRecord.id, deleteLinkedBooks);
      await reloadBooks();
      navigate("/library/series", { replace: true });
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to delete series"));
    }
  }

  async function duplicateCurrentSeries(options: DuplicateOptions) {
    if (!seriesRecord || !user) return;
    try {
      setActionError(null);
      const duplicate = await duplicateSeriesRecord(seriesRecord, seriesBooks, user.id, options);
      setDuplicateOpen(false);
      await Promise.all([reloadSeries(), reloadBooks()]);
      navigate(`/series/${duplicate.id}`, { state: { openEdit: true } });
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to duplicate series"));
    }
  }

  function openDuplicateDialog() {
    if (!seriesRecord || !user) return;
    const library = settings?.library ?? DEFAULT_LIBRARY_SETTINGS;
    const resolved = resolveDuplicateOptions("series", library.duplicate_journal_entries, library.duplicate_books, seriesBooks.length);
    if (resolved.needsDialog) {
      setDuplicateOpen(true);
      return;
    }
    void duplicateCurrentSeries(resolved.options);
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

  const back = <DetailBack label={seriesDetailLabel} fallbackTo={seriesFallback} onClose={onClose} />;
  if (booksLoading || seriesLoading) return <div className="rj-detail-page">{back}<PageLoading /></div>;

  if (booksError || seriesError) {
    return <div className="rj-detail-page">{back}<p role="alert" className="text-sm text-destructive">{booksError || seriesError}</p></div>;
  }

  if (!seriesRecord) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <AppHeading level={1} as="h1">Series not found</AppHeading>
        <p className="text-sm text-muted-foreground">
          This series may have been deleted or you may not have access.
        </p>
        {back}
      </div>
    );
  }

  if (isEditMode) {
    return (
      <div className="rj-detail-page space-y-6">
        <BackButton
          fallbackTo={seriesFallback}
          className="relative z-10 rounded-full bg-transparent hover:bg-background/20 hover:text-foreground"
          onClick={() => {
            setActionError(null);
            setIsEditMode(false);
          }}
        />

        <div className="relative z-10 space-y-2">
          <AppHeading level={1} as="h1">Edit series</AppHeading>
          <p className="text-sm text-muted-foreground">Update the series details shown in your library.</p>
        </div>

        {actionError && <p className="relative z-10 text-sm text-destructive">{actionError}</p>}
        <div className="relative z-10">
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
      </div>
    );
  }

  return (
    <div className="rj-detail-page">
      <DetailHero
        titleId={headingId}
        color={heroColor}
        navigation={back}
        artwork={<SeriesArtwork banner={seriesRecord.cover_url} volume={featuredVolume} />}
        actions={
          <DetailActionsMenu
            kind="series"
            label={seriesRecord.name}
            shareAttachmentLabel="Send the series as attachment in a chat"
            onEdit={() => setIsEditMode(true)}
            onDuplicate={openDuplicateDialog}
            onDelete={handleDeleteSeries}
            onSendAttachment={openAttachmentPicker}
            deleteTitle="Delete this series?"
            deleteDescription="This permanently deletes the series. Choose whether its linked books should be deleted too."
          />
        }
      >
        <BookDetailTitle
          id={headingId}
          title={seriesRecord.name}
          favorite={Boolean(seriesRecord.is_favorite)}
          onToggleFavorite={() => void handleToggleFavorite()}
        />
        <p className="rj-detail-author flex flex-wrap gap-x-1">
          {authors.length > 0 ? (
            authors.map((author, index) => (
              <span key={author}>
                <MetadataLink to={buildAuthorDetailPath(author)}>
                  {author}
                </MetadataLink>
                {index < authors.length - 1 ? "," : ""}
              </span>
            ))
          ) : (
            <span>Unknown author</span>
          )}
        </p>
        <div className="rj-detail-actions">
          {progressDetail.kind === "not-started" && (
            <Button type="button" onClick={progressDetail.onStartReading} disabled={progressDetail.startDisabled}>
              {progressDetail.startDisabled && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {progressDetail.startDisabled ? "Starting…" : "Start Reading"}
            </Button>
          )}
          <Button ref={journalEditor.triggerRef} type="button" variant="outline" disabled={!user} onClick={(event) => journalEditor.launch(event.currentTarget)}>
            <NotebookPen aria-hidden="true" />
            Add entry
          </Button>
        </div>
        {actionError && <p role="alert" className="rj-detail-notice text-sm text-destructive">{actionError}</p>}
        {shareStatus && <p role="status" className="rj-detail-notice text-sm">{shareStatus}</p>}
      </DetailHero>

      <div className="rj-detail-body">
        <dl className="rj-reading-stats rj-detail-summary-stats">
          <DetailStat icon={BookOpen} label="Books read" value={seriesBooks.length > 0 ? `${progress.finishedBooks} / ${seriesBooks.length}` : "0"} />
          <DetailStat icon={Star} label="Average rating" value={averageRating === null ? "No rating" : averageRating.toFixed(1)} />
        </dl>

        <AboutSection
          className="rj-detail-description"
          title="About this series"
          text={seriesRecord.description}
          titleContent={<DetailGenreTags genres={genres} slugByName={genreSlugByName} />}
        />

        {seriesBooks.length > 0 && (
          <SeriesProgressCard
            percentage={progress.percentage}
            stats={seriesStats}
            logsLoading={logsLoading}
            logsError={logsError}
            detail={progressDetail}
          />
        )}

        <DetailBooks books={seriesBooks} series />

        {(seriesBooks.length > 0 || insightsAnchored) && (
          <section id="insights" ref={insightsRef} aria-labelledby={`${headingId}-insights`} className="space-y-4 scroll-mt-4">
            <h2 id={`${headingId}-insights`}>Insights</h2>
            {seriesBooks.length > 0 ? (
              <>
                <BookHighlights rankings={seriesStats.rankings} label="Series book highlights" />
                <SeriesAnalyticsComparison stats={seriesStats} />
              </>
            ) : <p className="rj-detail-quiet text-sm">Books added to this series will appear here.</p>}
            {logsError && <p className="text-sm text-muted-foreground">Reading activity could not be loaded.</p>}
          </section>
        )}

        <DetailJournal
          sectionId="journal"
          entries={seriesJournal.entries}
          loading={seriesJournal.loading}
          error={seriesJournal.error}
          onAdd={journalEditor.launch}
          onEntryUpdated={(entry) => { if (entry.source === "series_note") seriesJournal.save(entry.seriesJournalEntry); }}
          onEntryDeleted={(entry) => { if (entry.source === "series_note") seriesJournal.remove(entry.sourceId); }}
          addDisabled={!user}
        />
      </div>
      <SendAttachmentDialog
        open={sendAttachmentOpen}
        onOpenChange={setSendAttachmentOpen}
        attachment={buildSeriesAttachment({
          seriesId: seriesRecord.id,
          seriesName: seriesRecord.name,
          seriesCoverUrl: seriesRecord.cover_url,
          seriesDescription: seriesRecord.description,
          books: seriesBooks,
          authorProfiles: authorRecords,
          includedQuotes: journalEntries
            .filter((note) => note.label === "quote" && seriesBookIds.has(note.book_id))
            .slice(0, 3),
        })}
        title={`Send "${seriesRecord.name}" to chat`}
        description="Add a message, then pick the chat you want to send this series to."
        onSent={() => setShareStatus("Series sent to chat.")}
      />
      <DuplicateOptionsDialog
        open={duplicateOpen}
        kind="series"
        linkedBookCount={seriesBooks.length}
        journalPreference={(settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_journal_entries}
        booksPreference={(settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_books}
        onOpenChange={setDuplicateOpen}
        onConfirm={duplicateCurrentSeries}
      />
    </div>
  );
}
