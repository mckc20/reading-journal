import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronRight, RefreshCw, SwatchBook } from "lucide-react";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Button } from "@/components/ui/button";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import { buildAuthorSummaries, getAuthorInitials } from "@/lib/authorShelf";
import { buildGenreSlugLookup } from "@/lib/genres";
import { buildSeriesGroups } from "@/lib/libraryShelves";
import BookShelf from "@/pages/library/BookShelf";
import LibraryBookCard from "@/pages/library/LibraryBookCard";
import SeriesStackCard from "@/pages/library/SeriesStackCard";
import type { AuthorSummary } from "@/lib/authorShelf";
import type { Book, Genre } from "@/types";

const recentlyAddedPreviewRows = 2;
const recentlyAddedPreviewGap = 12;
const recentlyAddedPreviewMinWidth = 82;
const recentlyAddedPreviewTargetWidth = 112;
const recentlyAddedPreviewMaxWidth = 124;

const libraryRedirectParamKeys = [
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
  "publisher",
  "source",
  "status",
  "progress",
  "publicationYear",
  "series",
  "author",
  "favorite",
];

function LoadingGrid() {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-muted" />
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

function getRecentlyAddedPreviewColumns(width: number): number {
  if (width <= 0) return 3;

  const maxColumns = Math.max(
    1,
    Math.floor((width + recentlyAddedPreviewGap) / (recentlyAddedPreviewMinWidth + recentlyAddedPreviewGap)),
  );
  let columns = Math.min(
    maxColumns,
    Math.max(
      2,
      Math.round((width + recentlyAddedPreviewGap) / (recentlyAddedPreviewTargetWidth + recentlyAddedPreviewGap)),
    ),
  );

  while (
    columns < maxColumns &&
    (width - recentlyAddedPreviewGap * (columns - 1)) / columns > recentlyAddedPreviewMaxWidth
  ) {
    columns += 1;
  }

  while (
    columns > 1 &&
    (width - recentlyAddedPreviewGap * (columns - 1)) / columns < recentlyAddedPreviewMinWidth
  ) {
    columns -= 1;
  }

  return columns;
}

function RecentlyAddedPreview({
  books,
  onBook,
}: {
  books: Book[];
  onBook: (book: Book) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const columns = getRecentlyAddedPreviewColumns(containerWidth);
  const coverWidth =
    containerWidth > 0
      ? Math.floor((containerWidth - recentlyAddedPreviewGap * (columns - 1)) / columns)
      : recentlyAddedPreviewTargetWidth;
  const visibleBooks = books.slice(0, columns * recentlyAddedPreviewRows);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observedContainer = container;

    function updateWidth() {
      setContainerWidth(observedContainer.clientWidth);
    }

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(observedContainer);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label="Recently added books"
      className="grid grid-rows-2 justify-start overflow-hidden"
      style={{
        gap: recentlyAddedPreviewGap,
        gridTemplateColumns: `repeat(${columns}, minmax(0, ${coverWidth}px))`,
      }}
    >
      {visibleBooks.map((book) => (
        <LibraryBookCard key={book.id} book={book} onBook={onBook} variant="shelf" />
      ))}
    </div>
  );
}

function EntityShelf({
  title,
  count,
  to,
  children,
  emptyMessage,
}: {
  title: string;
  count?: number;
  to: string;
  children: ReactNode;
  emptyMessage: string;
}) {
  return (
    <section className="min-w-0 border-b px-4 py-3 last:border-b-0 sm:px-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link to={to} className="group flex min-w-0 items-baseline gap-2">
          <h3 className="text-sm font-semibold leading-snug group-hover:text-primary">{title}</h3>
          {typeof count === "number" && <p className="text-xs text-muted-foreground">{count}</p>}
        </Link>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
          <Link to={to}>
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      {count === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/55 p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function HorizontalShelf({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}

function AuthorShelfItem({
  author,
  onOpen,
}: {
  author: AuthorSummary;
  onOpen: (authorId: string) => void;
}) {
  return (
    <button
      type="button"
      data-shelf-item
      className="group w-24 shrink-0 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-28"
      aria-label={author.name}
      onClick={() => onOpen(author.id)}
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity group-hover:opacity-90 sm:h-24 sm:w-24">
        {author.photo_url ? (
          <img src={author.photo_url} alt={author.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-medium leading-none">{getAuthorInitials(author.name)}</span>
        )}
      </div>
    </button>
  );
}

function GenreShelfItem({
  genre,
  slug,
}: {
  genre: Genre;
  slug: string;
}) {
  return (
    <Link
      to={`/genres/${slug}`}
      data-shelf-item
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={genre.name}
      title={genre.name}
    >
      <SwatchBook className="h-8 w-8" aria-hidden="true" />
    </Link>
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
          <AppHeading level={3} as="h2">{title}</AppHeading>
          {countLabel && <HeadingDescription className="text-xs">{countLabel}</HeadingDescription>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Library() {
  const { books, loading: booksLoading, error, reload } = useBooksContext();
  const { authors, loading: authorsLoading } = useAuthorsContext();
  const { genres, loading: genresLoading } = useGenresContext();
  const { series, loading: seriesLoading } = useSeries();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const sortedBooks = useMemo(() => sortByDateAdded(books), [books]);
  const authorSummaries = useMemo(() => buildAuthorSummaries(authors, sortedBooks), [authors, sortedBooks]);
  const seriesGroups = useMemo(
    () => buildSeriesGroups(sortedBooks, series, { includeEmpty: true }),
    [sortedBooks, series],
  );
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const hasExploreParams = libraryRedirectParamKeys.some((key) => searchParams.has(key));
  const loadingShelves = booksLoading || authorsLoading || seriesLoading || genresLoading;

  if ((viewParam && viewParam !== "all") || hasExploreParams) {
    const nextParams = new URLSearchParams(searchParams);
    return <Navigate to={`/library/books?${nextParams.toString()}`} replace />;
  }

  function openBook(book: Book) {
    navigate(`/books/${book.id}`);
  }

  function openAuthor(authorId: string) {
    navigate(`/authors/${encodeURIComponent(authorId)}`);
  }

  function openSeries(seriesId: string) {
    navigate(`/series/${seriesId}`);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <AppHeading level={1}>Library</AppHeading>
          <HeadingDescription>Your books, authors, series, genres, and journal.</HeadingDescription>
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

      <LibrarySection title="Shelves">
        {loadingShelves ? (
          <LoadingGrid />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <BookShelf
              title="Books"
              books={sortedBooks}
              onBook={openBook}
              onViewAll={() => navigate("/library/books")}
              emptyMessage="Books you add will appear here."
            />

            <EntityShelf
              title="Authors"
              count={authorSummaries.length}
              to="/library/authors"
              emptyMessage="Authors will appear here after you add books or authors."
            >
              <HorizontalShelf ariaLabel="Authors shelf">
                {authorSummaries.map((author) => (
                  <AuthorShelfItem key={author.id} author={author} onOpen={openAuthor} />
                ))}
              </HorizontalShelf>
            </EntityShelf>

            <EntityShelf
              title="Series"
              count={seriesGroups.length}
              to="/library/series"
              emptyMessage="Series you add will appear here."
            >
              <HorizontalShelf ariaLabel="Series shelf">
                {seriesGroups.map((group) => (
                  <div key={group.seriesId} data-shelf-item className="w-[122px] shrink-0 sm:w-[148px]">
                    <div className="[&_p]:sr-only">
                      <SeriesStackCard group={group} onSeries={openSeries} />
                    </div>
                  </div>
                ))}
              </HorizontalShelf>
            </EntityShelf>

            <EntityShelf
              title="Genres"
              count={genres.length}
              to="/library/genres"
              emptyMessage="Genres will appear here after you add them."
            >
              <HorizontalShelf ariaLabel="Genres shelf">
                {genres.map((genre) => (
                  <GenreShelfItem key={genre.id} genre={genre} slug={slugById.get(genre.id) ?? genre.id} />
                ))}
              </HorizontalShelf>
            </EntityShelf>

          </div>
        )}
      </LibrarySection>

      <LibrarySection
        title="Recently Added"
        countLabel={booksLoading ? "..." : bookCountLabel(books.length)}
      >
        {booksLoading ? (
          <LoadingGrid />
        ) : sortedBooks.length === 0 ? (
          <EmptyLibraryView message="No books yet. Tap + to add one." />
        ) : (
          <RecentlyAddedPreview books={sortedBooks} onBook={openBook} />
        )}
      </LibrarySection>
    </div>
  );
}
