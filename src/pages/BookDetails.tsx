import LoadingIndicator from "@/components/LoadingIndicator";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  Info,
  NotebookPen,
  PauseCircle,
  RefreshCw,
  Star,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import { AboutSection, AppHeading } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import JournalTimeline from "@/components/JournalTimeline";
import {
  buildBookLibraryFilterPath,
  MetadataLink,
} from "@/components/LinkedMetadata";
import BookReadingProgress from "@/components/BookReadingProgress";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/reading-journal/BookCover";
import { BookDetailTitle } from "@/components/redesign/BookDetailTitle";
import { BookProgress, getBookProgress } from "@/components/reading-journal/BookProgress";
import "@/components/redesign/book-details.css";
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

const BOOK_DETAIL_SHEET_MEDIA = "(max-width: 767px)";

function getPublicationYear(value?: string | null): string | null {
  const [year] = (value ?? "").split("-");
  return year && /^\d{4}$/.test(year) ? year : null;
}

export default function BookDetails() {
  const { bookId } = useParams<{ bookId: string }>();

  return <BookDetailSheet key={bookId} />;
}

function BookDetailSheet() {
  const navigate = useNavigate();
  const sheetRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const closingAnimation = useRef<Animation | null>(null);

  const close = useCallback(() => {
    if (closingAnimation.current) return;

    function leave() {
      if (window.history.state?.idx > 0) {
        navigate(-1);
      } else {
        navigate("/library", { replace: true });
      }
    }

    const sheet = sheetRef.current;
    if (!sheet || !window.matchMedia(BOOK_DETAIL_SHEET_MEDIA).matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      leave();
      return;
    }

    const animation = sheet.animate(
      [{ transform: getComputedStyle(sheet).transform }, { transform: "translateY(100%)" }],
      { duration: 165, easing: "cubic-bezier(.25, .35, .65, 1)", fill: "forwards" },
    );
    closingAnimation.current = animation;
    void animation.finished.then(leave, () => {
      // Leaving through browser history or navigation cancels this animation.
    });
  }, [navigate]);

  useEffect(() => {
    const sheet = sheetRef.current;
    const scroller = scrollerRef.current;
    if (!sheet || !scroller) return;
    const phone = window.matchMedia(BOOK_DETAIL_SHEET_MEDIA);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (phone.matches) sheet.focus({ preventScroll: true });

    let start: { x: number; y: number; id: number; dragging: boolean } | null = null;
    let settle: Animation | null = null;

    function resetDrag() {
      start = null;
      settle?.cancel();
      settle = null;
      if (!sheet?.style.getPropertyValue("--sheet-drag-transform")) return;
      const transform = getComputedStyle(sheet).transform;
      sheet.style.removeProperty("--sheet-drag-transform");
      if (!reducedMotion.matches) {
        settle = sheet.animate([{ transform }, { transform: "none" }], {
          duration: 220,
          easing: "cubic-bezier(.2, .75, .25, 1)",
        });
      }
    }

    function onTouchStart(event: TouchEvent) {
      if (closingAnimation.current) return;
      if (event.touches.length !== 1) {
        resetDrag();
        return;
      }
      if (!phone.matches || settle?.playState === "running" || (scroller?.scrollTop ?? 0) !== 0 ||
        sheet?.getAnimations().some((animation) => animation.playState === "running") ||
        !(event.target instanceof Element) ||
        event.target.closest("button, a, input, select, textarea, summary")) return;

      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, id: touch.identifier, dragging: false };
    }

    function onTouchMove(event: TouchEvent) {
      if (!start || !sheet) return;
      const touch = Array.from(event.touches).find(({ identifier }) => identifier === start?.id);
      if (!touch) return;
      const dx = Math.abs(touch.clientX - start.x);
      const dy = touch.clientY - start.y;

      if (!start.dragging && Math.max(dx, Math.abs(dy)) < 5) return;
      if (!start.dragging && (dy <= dx * 1.25 || (scroller?.scrollTop ?? 0) > 0 || !event.cancelable)) {
        start = null;
        return;
      }

      start.dragging = true;
      if (event.cancelable) event.preventDefault();
      if (!reducedMotion.matches) {
        // Snap to physical pixels so the rounded edge stays crisp while held.
        const distance = Math.min(sheet.clientHeight, Math.max(0, dy));
        const offset = Math.round(distance * window.devicePixelRatio) / window.devicePixelRatio;
        sheet.style.setProperty("--sheet-drag-transform", `translateY(${offset}px)`);
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (!start) return;
      const touch = Array.from(event.changedTouches).find(({ identifier }) => identifier === start?.id);
      const shouldClose = start.dragging && touch && touch.clientY - start.y >= 80;
      if (shouldClose) {
        start = null;
        close();
      } else {
        resetDrag();
      }
    }

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    scroller.addEventListener("touchcancel", resetDrag, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", resetDrag);
      settle?.cancel();
      if (closingAnimation.current) {
        closingAnimation.current.cancel();
        closingAnimation.current = null;
      }
    };
  }, [close]);

  return (
    <section className="rj-book-detail-sheet" ref={sheetRef} tabIndex={-1} aria-label="Book details">
      <div className="rj-book-detail-scroll" ref={scrollerRef}>
        <BookDetailsContent onClose={close} />
      </div>
    </section>
  );
}

function CloseBookDetailButton({ onClose }: { onClose: () => void }) {
  return (
    <>
      <Button type="button" variant="ghost" size="icon-lg" className="size-11 md:hidden" aria-label="Close book details" onClick={onClose}>
        <ChevronDown className="size-6" aria-hidden="true" />
      </Button>
      <BackButton fallbackTo="/library" className="hidden min-h-11 min-w-11 md:inline-flex" />
    </>
  );
}

function BookDetailsContent({ onClose }: { onClose: () => void }) {
  const { bookId } = useParams<{ bookId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { openAddJournalEntry, openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEntryId = searchParams.get("entry");
  const wantsJournalEditor = searchParams.get("new") === "1";
  const hasJournalAnchor = location.hash === BOOK_JOURNAL_HASH;
  const addEntryButtonRef = useRef<HTMLButtonElement>(null);
  const journalSectionRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (!journalAvailable || !hasJournalAnchor || selectedEntryId || wantsJournalEditor) return;
    journalSectionRef.current?.scrollIntoView({ block: "start" });
  }, [hasJournalAnchor, journalAvailable, selectedEntryId, wantsJournalEditor]);

  function handleJournalTimelineChange(entry: JournalTimelineEntry) {
    if (entry.source === "book_note") rememberSavedEntry(entry.bookJournalEntry);
  }

  if (loading) {
    return (
      <div className="rj-detail-page">
        <CloseBookDetailButton onClose={onClose} />
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
        <CloseBookDetailButton onClose={onClose} />
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
        <CloseBookDetailButton onClose={onClose} />
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
      <section className="rj-detail-hero" aria-labelledby="book-detail-title">
        <div
          className="rj-detail-cover-stage"
          style={{ "--book-detail-hero-color": coverColor } as CSSProperties}
        >
          <div className="rj-detail-topline">
            <CloseBookDetailButton onClose={onClose} />
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

            <BookDetailTitle id="book-detail-title" title={book.title} favorite={isFavorite} onToggleFavorite={toggleFavorite} />

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

        <section aria-labelledby="book-detail-progress">
          <div className="rj-detail-section-heading">
            <h2 id="book-detail-progress">Reading Progress</h2>
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

        <section ref={journalSectionRef} id={BOOK_JOURNAL_HASH.slice(1)} className="scroll-mt-4" aria-labelledby="book-detail-journal-title">
          <div className="rj-detail-section-heading">
            <h2 id="book-detail-journal-title">Journal</h2>
          </div>

          {journalEntriesLoading ? (
            <LoadingIndicator label="Loading journal entries…" />
          ) : journalEntriesError ? (
            <p className="text-sm text-destructive" role="alert">{journalEntriesError}</p>
          ) : visibleJournalEntries.length > 0 ? (
            <JournalTimeline
              entries={visibleJournalEntries}
              layout="list"
              initialEntryLimit={hasJournalAnchor ? undefined : 3}
              selectedEntryId={selectedEntryId}
              onEntryUpdated={handleJournalTimelineChange}
              onEntryCreated={handleJournalTimelineChange}
              onEntryDeleted={(entry) => {
                setJournalEntries((current) => current.filter((note) => note.id !== entry.sourceId));
              }}
            />
          ) : (
            <div className="rj-detail-empty">
              <NotebookPen aria-hidden="true" />
              <p>A place for your thoughts</p>
              <Button
                type="button"
                variant="outline"
                disabled={!user}
                onClick={(event) => launchJournalEditor(event.currentTarget)}
              >
                Write your first entry
              </Button>
            </div>
          )}
        </section>
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
