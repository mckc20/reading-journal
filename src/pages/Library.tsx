import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { cn } from "@/lib/utils";
import BookCard from "@/components/BookCard";
import type { Book, Series } from "@/types";

type LibraryView =
  | "all"
  | "tbr"
  | "reading"
  | "finished"
  | "wishlist"
  | "dnf"
  | "series"
  | "authors"
  | "genres"
  | "languages"
  | "format"
  | "belongs-to";

type PrimaryShelf = {
  value: LibraryView;
  label: string;
  matches: (book: Book) => boolean;
  emptyMessage: string;
};

type CategoryShelf = {
  value: LibraryView;
  label: string;
};

type BookGroup = {
  name: string;
  books: Book[];
};

const UNCATEGORIZED = "Uncategorized";

const primaryShelves: PrimaryShelf[] = [
  {
    value: "all",
    label: "All Books",
    matches: () => true,
    emptyMessage: "No books yet. Tap + to add one.",
  },
  {
    value: "tbr",
    label: "To Be Read",
    matches: (book) => ["Wishlist", "Not Started", "Up Next"].includes(book.status),
    emptyMessage: "No books in your reading list.",
  },
  {
    value: "reading",
    label: "Currently Reading",
    matches: (book) => book.status === "Reading",
    emptyMessage: "No books are currently in progress.",
  },
  {
    value: "finished",
    label: "Finished",
    matches: (book) => book.status === "Finished",
    emptyMessage: "No finished books yet.",
  },
  {
    value: "wishlist",
    label: "Wishlist",
    matches: (book) => book.status === "Wishlist",
    emptyMessage: "No wishlist books yet.",
  },
  {
    value: "dnf",
    label: "DNF",
    matches: (book) => book.status === "DNF",
    emptyMessage: "No DNF books yet.",
  },
];

const categoryShelves: CategoryShelf[] = [
  { value: "series", label: "Series" },
  { value: "authors", label: "Authors" },
  { value: "genres", label: "Genres" },
  { value: "languages", label: "Languages" },
  { value: "format", label: "Format" },
  { value: "belongs-to", label: "Belongs to" },
];

const validViews = new Set<LibraryView>([
  ...primaryShelves.map((shelf) => shelf.value),
  ...categoryShelves.map((shelf) => shelf.value),
]);

function isLibraryView(value: string | null): value is LibraryView {
  return value !== null && validViews.has(value as LibraryView);
}

function viewPath(view: LibraryView) {
  return `/library?view=${view}`;
}

function sortBooksByTitle(books: Book[]) {
  return [...books].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
  );
}

function sortBooksByVolume(books: Book[]) {
  return [...books].sort((a, b) => {
    const volumeA = a.volume_number ?? Number.MAX_SAFE_INTEGER;
    const volumeB = b.volume_number ?? Number.MAX_SAFE_INTEGER;

    if (volumeA !== volumeB) return volumeA - volumeB;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
  });
}

function sortGroups(groups: BookGroup[]) {
  return [...groups].sort((a, b) => {
    if (a.name === UNCATEGORIZED) return 1;
    if (b.name === UNCATEGORIZED) return -1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

function addBookToGroup(groups: Map<string, Book[]>, groupName: string, book: Book) {
  const existingBooks = groups.get(groupName) ?? [];
  existingBooks.push(book);
  groups.set(groupName, existingBooks);
}

function uniqueCleanValues(values: string[] | undefined) {
  return Array.from(new Set(values?.map((value) => value.trim()).filter(Boolean)));
}

function countUniqueBookValues(
  books: Book[],
  getValues: (book: Book) => string[] | undefined
) {
  const values = new Set<string>();

  books.forEach((book) => {
    uniqueCleanValues(getValues(book)).forEach((value) => values.add(value));
  });

  return values.size;
}

function buildMultiValueGroups(
  books: Book[],
  getValues: (book: Book) => string[] | undefined
) {
  const groups = new Map<string, Book[]>();

  books.forEach((book) => {
    const values = uniqueCleanValues(getValues(book));

    if (values.length === 0) {
      addBookToGroup(groups, UNCATEGORIZED, book);
      return;
    }

    values.forEach((value) => addBookToGroup(groups, value, book));
  });

  return sortGroups(
    Array.from(groups, ([name, groupBooks]) => ({
      name,
      books: sortBooksByTitle(groupBooks),
    }))
  );
}

function buildSingleValueGroups(books: Book[], getValue: (book: Book) => string | undefined) {
  const groups = new Map<string, Book[]>();

  books.forEach((book) => {
    addBookToGroup(groups, getValue(book) ?? UNCATEGORIZED, book);
  });

  return sortGroups(
    Array.from(groups, ([name, groupBooks]) => ({
      name,
      books: sortBooksByTitle(groupBooks),
    }))
  );
}

function buildSeriesGroups(books: Book[], series: Series[]) {
  const seriesById = new Map(series.map((item) => [item.id, item.name]));
  const groups = new Map<string, Book[]>();

  books.forEach((book) => {
    if (!book.series_id) return;

    const seriesName = seriesById.get(book.series_id);
    if (!seriesName) return;

    addBookToGroup(groups, seriesName, book);
  });

  return sortGroups(
    Array.from(groups, ([name, groupBooks]) => ({
      name,
      books: sortBooksByVolume(groupBooks),
    }))
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

function BooksGrid({ books, onBook }: { books: Book[]; onBook: (b: Book) => void }) {
  if (books.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:gap-3">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={onBook} textSize="compact" />
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function groupCountLabel(count: number) {
  return `${count} book${count !== 1 ? "s" : ""}`;
}

function LibraryShelfList({
  activeView,
  counts,
  categoryCounts,
  mobile = false,
}: {
  activeView?: LibraryView;
  counts: Partial<Record<LibraryView, number>>;
  categoryCounts: Partial<Record<LibraryView, number>>;
  mobile?: boolean;
}) {
  return (
    <nav className="space-y-4" aria-label="Library views">
      <div className="space-y-1">
        {primaryShelves.map((shelf) => {
          const active = activeView === shelf.value;

          return (
            <Link
              key={shelf.value}
              to={viewPath(shelf.value)}
              className={cn(
                "flex items-center rounded-lg transition-colors",
                mobile ? "gap-2 px-3 py-2 text-sm" : "gap-3 px-3 py-2 text-sm",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className="min-w-0">{shelf.label}</span>
              <span
                className={cn(
                  "text-muted-foreground",
                  mobile ? "text-sm" : "ml-auto text-xs"
                )}
              >
                {counts[shelf.value] ?? 0}
              </span>
              {mobile && (
                <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="space-y-1 pt-3">
        <p
          className={cn(
            "px-3 font-medium uppercase tracking-wide text-foreground",
            mobile ? "pb-1 pt-2 text-xs" : "text-xs"
          )}
        >
          Categories
        </p>
        {categoryShelves.map((shelf) => {
          const active = activeView === shelf.value;
          const count = categoryCounts[shelf.value];

          return (
            <Link
              key={shelf.value}
              to={viewPath(shelf.value)}
              className={cn(
                "flex items-center rounded-lg transition-colors",
                mobile ? "px-3 py-2 text-sm" : "px-3 py-2 text-sm",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className="min-w-0 flex-1">{shelf.label}</span>
              {count !== undefined && (
                <span className={cn("text-muted-foreground", mobile ? "text-sm" : "text-xs")}>
                  {count}
                </span>
              )}
              {mobile && (
                <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function GroupedBooksView({
  groups,
  onBook,
}: {
  groups: BookGroup[];
  onBook: (book: Book) => void;
}) {
  if (groups.length === 0) {
    return <EmptyLibraryView message="No books yet." />;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.name} className="space-y-3">
          <div>
            <h3 className="font-heading leading-snug font-medium">{group.name}</h3>
            <p className="text-xs text-muted-foreground">{groupCountLabel(group.books.length)}</p>
          </div>
          <Separator />
          <BooksGrid books={group.books} onBook={onBook} />
        </section>
      ))}
    </div>
  );
}

function getViewLabel(view: LibraryView) {
  return (
    primaryShelves.find((shelf) => shelf.value === view)?.label ??
    categoryShelves.find((shelf) => shelf.value === view)?.label ??
    "Library"
  );
}

export default function Library() {
  const { books, loading: booksLoading, error, reload } = useBooksContext();
  const { series, loading: seriesLoading } = useSeries();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const viewParam = searchParams.get("view");
  const hasExplicitView = isLibraryView(viewParam);
  const activeView = hasExplicitView ? viewParam : undefined;
  const contentView = activeView ?? "all";
  const loading = booksLoading || seriesLoading;
  const mobileHeading = activeView ? getViewLabel(activeView) : "Library";

  useEffect(() => {
    if (viewParam && !isLibraryView(viewParam)) {
      navigate("/library", { replace: true });
    }
  }, [navigate, viewParam]);

  function openBook(book: Book) {
    navigate(`/books/${book.id}`);
  }

  const primaryCounts = useMemo(
    () =>
      primaryShelves.reduce(
        (counts, shelf) => ({
          ...counts,
          [shelf.value]: books.filter(shelf.matches).length,
        }),
        {} as Partial<Record<LibraryView, number>>
      ),
    [books]
  );

  const categoryCounts = useMemo(
    () => ({
      series: series.filter((item) => books.some((book) => book.series_id === item.id)).length,
      authors: countUniqueBookValues(books, (book) => book.authors),
      genres: countUniqueBookValues(books, (book) => book.genres),
    }),
    [books, series]
  );

  const activePrimaryShelf = primaryShelves.find((shelf) => shelf.value === contentView);
  const visibleBooks = useMemo(() => {
    if (!activePrimaryShelf) return [];
    return sortBooksByTitle(books.filter(activePrimaryShelf.matches));
  }, [activePrimaryShelf, books]);

  const groupedBooks = useMemo(() => {
    if (contentView === "series") return buildSeriesGroups(books, series);
    if (contentView === "authors") return buildMultiValueGroups(books, (book) => book.authors);
    if (contentView === "genres") return buildMultiValueGroups(books, (book) => book.genres);
    if (contentView === "languages") return buildSingleValueGroups(books, (book) => book.language);
    if (contentView === "format") return buildSingleValueGroups(books, (book) => book.format);
    if (contentView === "belongs-to") {
      return buildSingleValueGroups(books, (book) => book.belongs_to);
    }
    return [];
  }, [contentView, books, series]);

  const displayedBookCount = activePrimaryShelf
    ? visibleBooks.length
    : books.length;

  return (
    <div className="space-y-4 md:flex md:h-[calc(100svh-6.5rem)] md:min-h-0 md:flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading leading-snug font-medium">
          <span className="md:hidden">{mobileHeading}</span>
          <span className="hidden md:inline">Library</span>
        </h1>
        <span className="text-sm text-muted-foreground">
          {loading ? "..." : `${displayedBookCount} book${displayedBookCount !== 1 ? "s" : ""}`}
        </span>
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

      <div className="md:hidden">
        {!hasExplicitView ? (
          <LibraryShelfList
            activeView={activeView}
            counts={primaryCounts}
            categoryCounts={categoryCounts}
            mobile
          />
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/library">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Library
            </Link>
          </Button>
        )}
      </div>

      <div
        className={cn(
          "grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[12rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)]",
          !hasExplicitView && "hidden md:grid"
        )}
      >
        <aside className="hidden md:block md:min-h-0 md:overflow-y-auto md:pr-1">
          <LibraryShelfList
            activeView={activeView}
            counts={primaryCounts}
            categoryCounts={categoryCounts}
          />
        </aside>

        <section className="min-w-0 md:min-h-0 md:overflow-y-auto md:pr-1">
          {loading ? (
            <LoadingGrid />
          ) : activePrimaryShelf ? (
            visibleBooks.length === 0 ? (
              <EmptyLibraryView message={activePrimaryShelf.emptyMessage} />
            ) : (
              <BooksGrid books={visibleBooks} onBook={openBook} />
            )
          ) : (
            <GroupedBooksView groups={groupedBooks} onBook={openBook} />
          )}
        </section>
      </div>
    </div>
  );
}
