import { useMemo, type ReactNode } from "react";
import { Navigate, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import BookShelf from "@/pages/library/BookShelf";
import ContinueReadingCard from "@/pages/library/ContinueReadingCard";
import LibraryBookCard from "@/pages/library/LibraryBookCard";
import ShelfCarousel from "@/pages/library/ShelfCarousel";
import type { Book } from "@/types";

type AppLayoutOutletContext = {
  onAddBookClick: () => void;
};

type ShelfView = "reading" | "tbr" | "finished" | "favorites";

type SmartShelf = {
  key: "currently-reading" | "want-to-read" | "recently-finished" | "favorites";
  title: string;
  books: Book[];
  view: ShelfView;
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

function LibraryPlaceholder({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
      {message}
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
      view: "reading",
      emptyMessage: "Books you are currently reading will appear here.",
    },
    {
      key: "want-to-read",
      title: "Want to Read",
      books: wantToRead,
      view: "tbr",
      emptyMessage: "Wishlist, Not Started, and Up Next books will appear here.",
    },
    {
      key: "recently-finished",
      title: "Recently Finished",
      books: recentlyFinished,
      view: "finished",
      emptyMessage: "Finished books will appear here.",
    },
    {
      key: "favorites",
      title: "Favorites",
      books: favorites,
      view: "favorites",
      emptyMessage: "Tap the heart on a book to collect favorites here.",
    },
  ];
}

export default function Library() {
  const { books, loading, error, reload } = useBooksContext();
  const { onAddBookClick } = useOutletContext<AppLayoutOutletContext>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const sortedBooks = useMemo(() => sortByDateAdded(books), [books]);
  const continueReadingBooks = useMemo(
    () => sortedBooks.filter((book) => book.status === "Reading"),
    [sortedBooks],
  );
  const smartShelves = useMemo(() => buildSmartShelves(sortedBooks), [sortedBooks]);
  const previewBooks = sortedBooks.slice(0, 12);
  const hasExploreParams = exploreParamKeys.some((key) => searchParams.has(key));

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-4xl font-bold leading-tight">My Books</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your library, your stories.</p>
        </div>
        <Button type="button" onClick={onAddBookClick} className="sm:w-auto">
          <Plus className="h-4 w-4" />
          Add Book
        </Button>
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

      <LibrarySection title="Continue Reading">
        {loading ? (
          <LoadingGrid />
        ) : continueReadingBooks.length > 0 ? (
          <ShelfCarousel
            ariaLabel="Continue reading books"
            itemClassName="w-[72vw] max-w-[18rem] shrink-0 sm:w-[15rem] lg:w-[13.5rem]"
            className="gap-4"
          >
            {continueReadingBooks.slice(0, 8).map((book) => (
              <ContinueReadingCard key={book.id} book={book} onBook={openBook} />
            ))}
          </ShelfCarousel>
        ) : (
          <LibraryPlaceholder message="Books you are currently reading will appear here first." />
        )}
      </LibrarySection>

      <LibrarySection title="Your Shelves">
        {loading ? (
          <LoadingGrid />
        ) : (
          <div className="space-y-7">
            {smartShelves.map((shelf) => (
              <BookShelf
                key={shelf.key}
                title={shelf.title}
                books={shelf.books}
                onBook={openBook}
                onViewAll={() => openExplore(`/library/explore?view=${shelf.view}`)}
                emptyMessage={shelf.emptyMessage}
              />
            ))}
          </div>
        )}
      </LibrarySection>

      <LibrarySection
        title="All Books"
        countLabel={loading ? "..." : bookCountLabel(books.length)}
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => openExplore()}>
            Explore more
            <ChevronRight className="h-4 w-4" />
          </Button>
        }
      >
        {loading ? (
          <LoadingGrid />
        ) : previewBooks.length === 0 ? (
          <EmptyLibraryView message="No books yet. Tap + to add one." />
        ) : (
          <div
            aria-label="All books preview"
            className="grid grid-cols-[repeat(auto-fill,110px)] justify-start gap-3 sm:grid-cols-[repeat(auto-fill,140px)]"
          >
            {previewBooks.map((book) => (
              <LibraryBookCard key={book.id} book={book} onBook={openBook} variant="shelf" />
            ))}
          </div>
        )}
      </LibrarySection>
    </div>
  );
}
