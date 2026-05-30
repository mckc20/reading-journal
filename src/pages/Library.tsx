import { useEffect, useMemo, useRef, useState, type ReactNode, type WheelEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { buildSeriesGroups, type SeriesBookGroup } from "@/lib/libraryShelves";
import BookShelf from "@/pages/library/BookShelf";
import LibraryBookCard from "@/pages/library/LibraryBookCard";
import SeriesStackCard from "@/pages/library/SeriesStackCard";
import type { Book } from "@/types";

type SmartShelf = {
  key: "currently-reading" | "want-to-read" | "recently-finished" | "favorites";
  title: string;
  books: Book[];
  emptyMessage: string;
};

const recentlyFinishedWindowMs = 5 * 7 * 24 * 60 * 60 * 1000;

const exploreParamKeys = [
  "q",
  "sort",
  "display",
  "mode",
  "value",
  "genre",
  "rating",
  "year",
  "format",
  "language",
  "belongsTo",
  "status",
  "progress",
  "series",
  "author",
  "favorite",
];

function LoadingGrid() {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function EmptyLibraryView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function LibrarySection({
  title,
  countLabel,
  action,
  children,
}: {
  title: string;
  countLabel?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-medium leading-snug">{title}</h2>
          {countLabel && <p className="text-xs text-muted-foreground">{countLabel}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function compareRecentlyFinishedBooks(a: Book, b: Book): number {
  const finishedA = a.date_finished ? new Date(a.date_finished).getTime() : 0;
  const finishedB = b.date_finished ? new Date(b.date_finished).getTime() : 0;
  const addedA = new Date(a.created_at).getTime();
  const addedB = new Date(b.created_at).getTime();

  return finishedB - finishedA || addedB - addedA || a.title.localeCompare(b.title);
}

function sortByDateAdded(books: Book[]): Book[] {
  return [...books].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
      a.title.localeCompare(b.title),
  );
}

function bookCountLabel(count: number) {
  return `${count} book${count === 1 ? "" : "s"}`;
}

function wasFinishedInRecentWindow(book: Book, now = Date.now()): boolean {
  if (book.status !== "Finished" || !book.date_finished) return false;

  const finishedAt = new Date(book.date_finished).getTime();
  if (!Number.isFinite(finishedAt)) return false;

  return finishedAt <= now && finishedAt >= now - recentlyFinishedWindowMs;
}

function buildSmartShelves(books: Book[]): SmartShelf[] {
  const now = Date.now();
  const currentlyReading = books.filter((book) => book.status === "Reading");
  const wantToRead = books.filter((book) =>
    ["Wishlist", "Not Started", "Up Next"].includes(book.status),
  );
  const recentlyFinished = books
    .filter((book) => wasFinishedInRecentWindow(book, now))
    .sort(compareRecentlyFinishedBooks);
  const favorites = books.filter((book) => book.is_favorite);

  return [
    {
      key: "currently-reading",
      title: "Currently Reading",
      books: currentlyReading,
      emptyMessage: "Books you are currently reading will appear here.",
    },
    {
      key: "want-to-read",
      title: "Want to Read",
      books: wantToRead,
      emptyMessage: "Wishlist, Not Started, and Up Next books will appear here.",
    },
    {
      key: "recently-finished",
      title: "Recently Finished",
      books: recentlyFinished,
      emptyMessage: "Finished books will appear here.",
    },
    {
      key: "favorites",
      title: "Favorites",
      books: favorites,
      emptyMessage: "Tap the heart on a book to collect favorites here.",
    },
  ];
}

function buildShelfExplorePath(shelf: SmartShelf): string {
  const params = new URLSearchParams();

  if (shelf.key === "currently-reading") {
    params.set("status", "Currently Reading");
  } else if (shelf.key === "want-to-read") {
    params.set("status", "Want to Read");
  } else if (shelf.key === "recently-finished") {
    params.set("sort", "date-finished");
  } else if (shelf.key === "favorites") {
    params.set("favorite", "Yes");
  }

  return `/library/explore?${params.toString()}`;
}

function SeriesShelf({
  groups,
  onViewAll,
  onSeries,
}: {
  groups: SeriesBookGroup[];
  onViewAll: () => void;
  onSeries: (seriesId: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollButtons() {
    const row = rowRef.current;
    if (!row) return;

    setCanScrollLeft(row.scrollLeft > 1);
    setCanScrollRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
  }

  function scrollOneSeries(direction: "left" | "right") {
    const row = rowRef.current;
    const firstItem = row?.querySelector<HTMLElement>("[data-shelf-item]");
    if (!row || !firstItem) return;

    const gap = parseFloat(getComputedStyle(row).columnGap || "0");
    const step = firstItem.offsetWidth + gap;

    row.scrollBy({
      left: direction === "right" ? step : -step,
      behavior: "smooth",
    });
  }

  function handleRowWheel(event: WheelEvent<HTMLDivElement>) {
    const row = rowRef.current;
    if (!row) return;

    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (rawDelta === 0) return;

    const scrollLeft = row.scrollLeft;
    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    const canMoveLeft = rawDelta < 0 && scrollLeft > 1;
    const canMoveRight = rawDelta > 0 && scrollLeft < maxScrollLeft - 1;

    if (!canMoveLeft && !canMoveRight) return;

    event.preventDefault();
    row.scrollBy({
      left: rawDelta,
      behavior: "auto",
    });
  }

  useEffect(() => {
    updateScrollButtons();

    const row = rowRef.current;
    if (!row) return;

    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(row);

    return () => resizeObserver.disconnect();
  }, [groups.length]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <section className="min-w-0 px-4 py-3 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold leading-snug">Book Series</h3>
              <p className="text-xs text-muted-foreground">{groups.length}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={onViewAll}
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {groups.length > 0 ? (
          <div className="relative">
            {canScrollLeft && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="absolute left-0 top-1/2 z-40 -translate-y-1/2 rounded-full bg-background shadow-sm"
                onClick={() => scrollOneSeries("left")}
                aria-label="Scroll Book Series left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}

            <div
              ref={rowRef}
              aria-label="Book series shelf"
              className="flex gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onScroll={updateScrollButtons}
              onWheel={handleRowWheel}
            >
              {groups.map((group) => (
                <SeriesStackCard key={group.seriesId} group={group} onSeries={onSeries} />
              ))}
            </div>

            {canScrollRight && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="absolute right-0 top-1/2 z-40 -translate-y-1/2 rounded-full bg-background shadow-sm"
                onClick={() => scrollOneSeries("right")}
                aria-label="Scroll Book Series right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-background/55 p-4 text-sm text-muted-foreground">
            Series you add to books will appear here.
          </div>
        )}
      </section>
    </div>
  );
}

export default function Library() {
  const { books, loading, error, reload } = useBooksContext();
  const { series, loading: seriesLoading } = useSeries();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const sortedBooks = useMemo(() => sortByDateAdded(books), [books]);
  const smartShelves = useMemo(() => buildSmartShelves(sortedBooks), [sortedBooks]);
  const seriesGroups = useMemo(
    () => buildSeriesGroups(sortedBooks, series),
    [sortedBooks, series],
  );
  const hasExploreParams = exploreParamKeys.some((key) => searchParams.has(key));
  const loadingSeries = loading || seriesLoading;

  if ((viewParam && viewParam !== "all") || hasExploreParams) {
    const nextParams = new URLSearchParams(searchParams);
    return <Navigate to={`/library/explore?${nextParams.toString()}`} replace />;
  }

  function openBook(book: Book) {
    navigate(`/books/${book.id}`);
  }

  function openExplore(path = "/library/explore") {
    navigate(path);
  }

  function openSeries(seriesId: string) {
    navigate(`/series/${seriesId}`);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-4xl font-bold leading-tight">My Books</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your library, your stories.</p>
        </div>
      </div>

      {error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      <LibrarySection title="Bookshelves">
        {loading ? (
          <LoadingGrid />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            {smartShelves.map((shelf) => (
              <BookShelf
                key={shelf.key}
                title={shelf.title}
                books={shelf.books}
                onBook={openBook}
                onViewAll={() => openExplore(buildShelfExplorePath(shelf))}
                emptyMessage={shelf.emptyMessage}
              />
            ))}
          </div>
        )}
      </LibrarySection>

      <section className="min-w-0 space-y-3">
        {loadingSeries ? (
          <LoadingGrid />
        ) : (
          <SeriesShelf
            groups={seriesGroups}
            onViewAll={() => navigate("/series")}
            onSeries={openSeries}
          />
        )}
      </section>

      <LibrarySection
        title="All Books"
        countLabel={loading ? "..." : bookCountLabel(books.length)}
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => openExplore()}>
            View all
            <ChevronRight className="h-4 w-4" />
          </Button>
        }
      >
        {loading ? (
          <LoadingGrid />
        ) : sortedBooks.length === 0 ? (
          <EmptyLibraryView message="No books yet. Tap + to add one." />
        ) : (
          <div
            aria-label="All books preview"
            className="grid max-h-[282px] grid-cols-[repeat(auto-fill,90px)] justify-start gap-3 overflow-hidden sm:max-h-[348px] sm:grid-cols-[repeat(auto-fill,112px)]"
          >
            {sortedBooks.map((book) => (
              <LibraryBookCard key={book.id} book={book} onBook={openBook} variant="shelf" />
            ))}
          </div>
        )}
      </LibrarySection>
    </div>
  );
}
