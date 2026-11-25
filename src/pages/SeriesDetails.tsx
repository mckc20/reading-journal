import LoadingIndicator from "@/components/LoadingIndicator";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useRef,
} from "react";
import { Link, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  Flag,
  Loader2,
  NotebookPen,
  Star,
} from "lucide-react";
import AddSeriesDialog from "@/components/AddSeriesDialog";
import { AboutSection, AppHeading } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import DuplicateOptionsDialog, { resolveDuplicateOptions, type DuplicateOptions } from "@/components/DuplicateOptionsDialog";
import { BookCover } from "@/components/reading-journal/BookCover";
import { BookDetailTitle } from "@/components/redesign/BookDetailTitle";
import { DetailGenreTags, DetailHero, DetailStat } from "@/components/redesign/DetailHero";
import { SeriesCoverStack } from "@/components/redesign/SeriesCoverStack";
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
import { Button } from "@/components/ui/button";
import { useAuth, useUserSettings } from "@/context";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import { useDetailSectionAnchor } from "@/hooks/useDetailSectionAnchor";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import { parseLocalDateOnly } from "@/lib/bookAnalytics";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import { fetchReadingLogs } from "@/lib/books";
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
import type { AuthorJournalEntryRecord, Book, BookJournalEntryRecord, ReadingLog, SeriesJournalEntryRecord } from "@/types";

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

function SeriesArtwork({ banner, books }: { banner?: string | null; books: Book[] }) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const showBanner = banner && banner !== failedBanner;
  return (
    <div className="rj-series-detail-artwork">
      {showBanner && <div className="rj-detail-banner">
        <img src={banner} alt="" className="size-full object-cover" onError={() => setFailedBanner(banner)} />
      </div>}
      {(!showBanner || books.some(book => book.cover_url)) && <SeriesCoverStack books={books} />}
    </div>
  );
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
  const [editOpen, setEditOpen] = useState(false);
  const editTriggerRef = useRef<HTMLElement | null>(null);
  const [startingBookId, setStartingBookId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const seriesRecord = series.find((item) => item.id === seriesId) ?? null;
  const insightsAnchored = location.hash === "#insights" || location.hash === "#analytics";
  const insightsRef = useDetailSectionAnchor(
    location.hash === "#analytics" ? "analytics" : "insights",
    !booksLoading && !seriesLoading && !editOpen,
  );
  const seriesJournal = useDetailJournalEntries(seriesRecord?.id, fetchSeriesJournalEntryRecords, seriesJournalToJournalEntries);
  const saveJournalEntry = useCallback((record: AuthorJournalEntryRecord | BookJournalEntryRecord | SeriesJournalEntryRecord) => {
    if ("series_id" in record && record.series_id === seriesRecord?.id) seriesJournal.save(record);
  }, [seriesRecord?.id, seriesJournal.save]);
  const journalEditor = useDetailJournalEditor("Series", !booksLoading && !seriesLoading && !editOpen && user ? seriesRecord?.id : undefined, saveJournalEntry);
  useEffect(() => {
    if (!seriesRecord || location.state?.openEdit !== true) return;
    setEditOpen(true);
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

  return (
    <div className="rj-detail-page">
      <DetailHero
        titleId={headingId}
        color={heroColor}
        navigation={back}
        artwork={<SeriesArtwork banner={seriesRecord.cover_url} books={seriesBooks} />}
        actions={
          <DetailActionsMenu
            kind="series"
            label={seriesRecord.name}
            shareAttachmentLabel="Send the series as attachment in a chat"
            onEdit={(trigger) => {
              editTriggerRef.current = trigger ?? null;
              setEditOpen(true);
            }}
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
      {editOpen && (
        <AddSeriesDialog
          open
          initialSeries={seriesRecord}
          openAddBook={openAddBook}
          onUpdateSeries={editSeries}
          onOpenChange={setEditOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editTriggerRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
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
