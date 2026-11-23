import LoadingIndicator from "@/components/LoadingIndicator";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Info,
  NotebookPen,
  PauseCircle,
  RefreshCw,
  Star,
} from "lucide-react";
import { AboutSection, AppHeading } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import { DetailJournal } from "@/components/redesign/DetailJournal";
import {
  buildBookLibraryFilterPath,
  MetadataLink,
} from "@/components/LinkedMetadata";
import BookReadingProgress from "@/components/BookReadingProgress";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { BookCover } from "@/components/reading-journal/BookCover";
import { BookDetailTitle } from "@/components/redesign/BookDetailTitle";
import { BookProgress, getBookProgress } from "@/components/reading-journal/BookProgress";
import { DetailBack, DetailSheet } from "@/components/redesign/DetailSheet";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { useAuth } from "@/context";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import { useSeries } from "@/hooks/useSeries";
import { fetchBookJournalEntryRecords, sortBookJournalEntryRecords } from "@/lib/bookJournal";
import { fetchReadingLogsForBook } from "@/lib/books";
import { moveBookToWishlist } from "@/lib/wishlist";
import { buildBookAttachment } from "@/lib/chatAttachments";
import { buildAuthorSummaries, findAuthorSummary } from "@/lib/authorShelf";
import { buildGenreSlugLookup, formatGenrePathForDisplay, getSelectedGenreTags } from "@/lib/genreTree";
import {
  bookJournalToJournalEntries,
  sortJournalEntries,
  type JournalTimelineEntry,
} from "@/lib/journal";
import { BOOK_JOURNAL_HASH } from "@/lib/journalLinks";
import {
  formatPublicationDateForDisplay,
} from "@/lib/publicationDate";
import {
  getTodayLocalDate,
} from "@/lib/utils";
import type {
  Book,
  BookJournalEntryRecord,
  BookStatus,
  ReadingLog,
} from "@/types";

const STATUS_OPTIONS: BookStatus[] = [
  "To Read",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

function getPublicationYear(value?: string | null): string | null {
  const [year] = (value ?? "").split("-");
  return year && /^\d{4}$/.test(year) ? year : null;
}

export default function BookDetails() {
  const { bookId } = useParams<{ bookId: string }>();

  return (
    <DetailSheet key={bookId} label="Book details" fallbackTo="/library">
      {(close) => <BookDetailsContent onClose={close} />}
    </DetailSheet>
  );
}

function BookDetailsContent({ onClose }: { onClose: () => void }) {
  const headingId = useId();
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { openAddJournalEntry, openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const wantsJournalEditor = searchParams.get("new") === "1";
  const addEntryButtonRef = useRef<HTMLButtonElement>(null);
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
  const coverColor = useBookHeroColor(book?.cover_url);
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
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [logsAttempt, setLogsAttempt] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(true);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);
  const [sendAttachmentOpen, setSendAttachmentOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const { authors } = useAuthorsContext();
  useEffect(() => {
    if (!book) return;
    setIsFavorite(book.is_favorite);
    setLocalRating(book.rating ?? null);
    setErrorMsg(null);
  }, [book]);

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
  }, [bookId, logsAttempt]);

  useEffect(() => {
    if (!bookId) return;
    const currentBookId = bookId;
    let cancelled = false;

    async function run() {
      try {
        setJournalEntriesLoading(true);
        setJournalEntriesError(null);
        const data = await fetchBookJournalEntryRecords(currentBookId);
        if (!cancelled) {
          // An entry saved while the initial request was pending takes precedence.
          setJournalEntries((current) => sortBookJournalEntryRecords([
            ...data.filter((note) => !current.some((saved) => saved.id === note.id)),
            ...current,
          ]));
        }
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

  const progressPercent = book ? getBookProgress(book.current_page, book.total_pages) : null;
  const authorSummaries = useMemo(
    () => buildAuthorSummaries(authors, books, journalEntries, wishlistBooks),
    [authors, books, journalEntries, wishlistBooks],
  );

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

  const visibleJournalEntries = useMemo(
    () => sortJournalEntries(bookJournalToJournalEntries(journalEntries).map((entry) => ({
      ...entry,
      relatedBookTitle: book?.title,
    }))),
    [book?.title, journalEntries],
  );

  const rememberSavedEntry = useCallback((entry: BookJournalEntryRecord) => {
    if (entry.book_id !== bookId) return;
    setJournalEntries((current) => {
      const otherEntries = current.filter((note) => note.id !== entry.id);
      if (entry.parent_entry_id) return otherEntries.length === current.length ? current : otherEntries;
      return sortBookJournalEntryRecords([entry, ...otherEntries]);
    });
  }, [bookId]);

  const launchJournalEditor = useCallback((trigger?: HTMLElement, initialTags?: string[]) => {
    if (!bookId || !user) return;
    openAddJournalEntry({
      initialBookId: bookId,
      initialTags,
      onSaved: (entry) => { if ("book_id" in entry) rememberSavedEntry(entry); },
    }, trigger);
  }, [bookId, openAddJournalEntry, rememberSavedEntry, user]);

  const journalAvailable = Boolean(book) && !loading && !error;
  useEffect(() => {
    if (!journalAvailable || !wantsJournalEditor || !user) return;
    launchJournalEditor(addEntryButtonRef.current ?? undefined, searchParams.get("tag") === "review" ? ["review"] : undefined);

    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("tag");
    setSearchParams(next, { replace: true });
  }, [journalAvailable, launchJournalEditor, searchParams, setSearchParams, user, wantsJournalEditor]);

  function handleJournalTimelineChange(entry: JournalTimelineEntry) {
    if (entry.source === "book_note") rememberSavedEntry(entry.bookJournalEntry);
  }

  if (loading) {
    return (
      <div className="rj-detail-page">
        <DetailBack label="Book details" fallbackTo="/library" onClose={onClose} />
        <LoadingIndicator variant="page" />
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
        <DetailBack label="Book details" fallbackTo="/library" onClose={onClose} />
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
        <DetailBack label="Book details" fallbackTo="/library" onClose={onClose} />
      </div>
    );
  }

  const currentPage = book.current_page ?? 0;
  const totalPages = book.total_pages ?? 0;
  const isPaused = book.status === "Paused";
  const isReading = book.status === "Reading";
  const readingActionLabel = book.status === "Finished" ? "Reread" : "Start Reading";
  const hasSecondaryMetadata = Boolean(book.format || book.language || publicationYear || book.source || book.isbn);
  const description = book.description?.trim() || "";
  return (
    <div className="rj-detail-page">
      <section className="rj-detail-hero" aria-labelledby={headingId}>
        <div
          className="rj-detail-cover-stage"
          style={{ "--book-detail-hero-color": coverColor } as CSSProperties}
        >
          <div className="rj-detail-topline">
            <DetailBack label="Book details" fallbackTo="/library" onClose={onClose} />
            <DetailActionsMenu
              kind="book"
              label={book.title}
              shareAttachmentLabel="Send the book as attachment in a chat"
              onPause={isReading ? () => void handlePause() : undefined}
              onResume={isPaused ? () => void handleResume() : undefined}
              onEdit={(trigger) => openAddBook({ editBook: book }, trigger)}
              onDuplicate={(trigger) => openAddBook({ duplicateBooks: [book] }, trigger)}
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

            <BookDetailTitle id={headingId} title={book.title} favorite={isFavorite} onToggleFavorite={toggleFavorite} />

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
                  <NativeSelect
                    aria-label="Reading status"
                    value={book.status}
                    onChange={(event) => void handleStatusChange(event.currentTarget.value as BookStatus)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </NativeSelect>
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
                    aria-describedby={showRatingGuide ? `${headingId}-rating-guide` : undefined}
                    onClick={() => setShowRatingGuide((current) => !current)}
                    className="rounded-full p-0.5 text-muted-foreground/65 transition-colors hover:bg-muted/60 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                  {showRatingGuide && (
                    <div
                      id={`${headingId}-rating-guide`}
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
                onJournalEntrySaved={rememberSavedEntry}
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
            <Button
              ref={addEntryButtonRef}
              type="button"
              variant="outline"
              disabled={!user}
              onClick={(event) => launchJournalEditor(event.currentTarget)}
            >
              <NotebookPen aria-hidden="true" />
              Add entry
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

        <section aria-labelledby={`${headingId}-progress`}>
          <div className="rj-detail-section-heading">
            <h2 id={`${headingId}-progress`}>Reading Progress</h2>
          </div>

          {logsLoading ? (
            <LoadingIndicator label="Loading reading progress…" />
          ) : logsError ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive" role="alert">{logsError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setLogsAttempt((attempt) => attempt + 1)}>
                Retry
              </Button>
            </div>
          ) : (
            <BookReadingProgress book={book} logs={readingLogs} />
          )}
        </section>

        <DetailJournal
          sectionId={BOOK_JOURNAL_HASH.slice(1)}
          entries={visibleJournalEntries}
          loading={journalEntriesLoading}
          error={journalEntriesError}
          onAdd={launchJournalEditor}
          onEntryUpdated={handleJournalTimelineChange}
          onEntryDeleted={(entry) => {
            setJournalEntries((current) => current.filter((note) => note.id !== entry.sourceId));
          }}
          addDisabled={!user}
        />
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
