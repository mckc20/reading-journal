import LoadingIndicator from "@/components/LoadingIndicator";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bookmark,
  BookOpen,
  ChevronRight,
  LibraryBig,
  RefreshCw,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/reading-journal";
import { Button } from "@/components/ui/button";
import { bookCardInteractiveClassName } from "@/components/BookCardContent";
import { GenreIllustration } from "@/components/genres/GenreVisuals";
import { ShelfBookCard } from "@/components/redesign/HomeCards";
import { cn } from "@/lib/utils";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import { buildAuthorSummaries, getAuthorInitials } from "@/lib/authorShelf";
import { buildGenreSlugLookup } from "@/lib/genres";
import { sortGenresByRecentBooks } from "@/lib/genreCollection";
import { buildSeriesGroups } from "@/lib/libraryShelves";
import HorizontalShelf from "@/pages/library/HorizontalShelf";
import SeriesStackCard from "@/pages/library/SeriesStackCard";
import type { AuthorSummary } from "@/lib/authorShelf";
import type { Book, Genre } from "@/types";
import "./library/library-overview.css";

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
  "source",
  "status",
  "progress",
  "publicationYear",
  "series",
  "author",
  "favorite",
];

const mobileLibraryCategories: Array<{ key: "books" | "authors" | "series" | "genres" | "wishlist"; label: string; to: string; icon: LucideIcon }> = [
  { key: "books", label: "Books", to: "/library/books", icon: BookOpen },
  { key: "authors", label: "Authors", to: "/library/authors", icon: UserRound },
  { key: "series", label: "Series", to: "/library/series", icon: LibraryBig },
  { key: "wishlist", label: "Wishlist", to: "/library/wishlist", icon: Bookmark },
  { key: "genres", label: "Genres", to: "/library/genres", icon: Tags },
];

function sortByDateAdded(books: Book[]): Book[] {
  return [...books].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
      a.title.localeCompare(b.title),
  );
}

function OverviewBookCard({
  book,
  onOpen,
  showAuthor = false,
}: {
  book: Book;
  onOpen: (book: Book) => void;
  showAuthor?: boolean;
}) {
  return (
    <ShelfBookCard
      book={{
        id: book.id,
        title: book.title,
        cover: book.cover_url,
        favorite: book.is_favorite,
        paused: book.status === "Paused",
        author: showAuthor ? book.authors.join(", ") : undefined,
      }}
      onOpen={() => onOpen(book)}
    />
  );
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
      className="rj-library-recent-grid"
      style={{
        gap: recentlyAddedPreviewGap,
        gridTemplateColumns: `repeat(${columns}, minmax(0, ${coverWidth}px))`,
      }}
    >
      {visibleBooks.map((book) => (
        <OverviewBookCard key={book.id} book={book} onOpen={onBook} showAuthor />
      ))}
    </div>
  );
}

function OverviewSection({
  title,
  count,
  countUnit,
  to,
  children,
  emptyMessage,
}: {
  title: string;
  count?: number;
  countUnit?: string;
  to?: string;
  children: ReactNode;
  emptyMessage: string;
}) {
  const titleId = useId();
  return (
    <section className="rj-home-section rj-library-overview-section" aria-labelledby={titleId}>
      <div className="rj-library-overview-section-heading">
        <h2 id={titleId}>{to ? <Link to={to}>{title}</Link> : title}</h2>
        <span className="rj-library-count">
          {count ?? "…"}{count !== undefined && countUnit && ` ${countUnit}${count === 1 ? "" : "s"}`}
        </span>
        {to && (
          <Button variant="ghost" className="rj-library-view-all" asChild>
            <Link to={to} aria-label={`View all ${title.toLowerCase()}`}>
              View all
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
      {count === 0 ? (
        <EmptyState compact message={emptyMessage} />
      ) : (
        children
      )}
    </section>
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
      className={cn("group w-24 shrink-0 space-y-3 rounded-md text-center sm:w-28", bookCardInteractiveClassName)}
      aria-label={author.name}
      onClick={() => onOpen(author.id)}
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm sm:h-24 sm:w-24">
        {author.photo_url ? (
          <img src={author.photo_url} alt={author.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-medium leading-none">{getAuthorInitials(author.name)}</span>
        )}
      </div>
      <p className="line-clamp-2 break-words text-sm font-medium leading-relaxed underline-offset-4 group-hover:underline group-focus-visible:underline">{author.name}</p>
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
      className={cn("group flex w-24 shrink-0 flex-col items-center gap-3 rounded-md text-center sm:w-28", bookCardInteractiveClassName)}
      aria-label={genre.name}
      title={genre.name}
    >
      <div className="flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
        <GenreIllustration slug={slug} className="h-10 w-10 sm:h-12 sm:w-12" />
      </div>
      <p className="line-clamp-2 break-words text-sm font-medium leading-relaxed underline-offset-4 group-hover:underline group-focus-visible:underline">{genre.name}</p>
    </Link>
  );
}

function MobileLibraryCategoryList({
  counts,
}: {
  counts: Record<(typeof mobileLibraryCategories)[number]["key"], number | string>;
}) {
  return (
    <nav aria-label="Library categories" className="rj-library-directory">
      {mobileLibraryCategories.map(({ key, label, to, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="rj-library-category"
        >
          <span className="rj-library-category-icon"><Icon size={18} aria-hidden="true" /></span>
          <span className="rj-library-category-label">{label}</span>
          <span className="rj-library-count">{counts[key]}</span>
          <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

export default function Library() {
  const { books, wishlistBooks: wishlist, loading: booksLoading, error, reload } = useBooksContext();
  const { authors, loading: authorsLoading } = useAuthorsContext();
  const { genres, loading: genresLoading } = useGenresContext();
  const { series, loading: seriesLoading } = useSeries();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const sortedBooks = useMemo(() => sortByDateAdded(books), [books]);
  const authorSummaries = useMemo(() => buildAuthorSummaries(authors, sortedBooks, [], wishlist), [authors, sortedBooks, wishlist]);
  const seriesGroups = useMemo(
    () => buildSeriesGroups(sortedBooks, series.filter((item) => !item.is_wishlist_only), { includeEmpty: true }),
    [sortedBooks, series],
  );
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const recentGenres = useMemo(() => sortGenresByRecentBooks(genres, books), [genres, books]);
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
    <div className="rj-library-overview">
      <h1 className="rj-app-home-title">Library</h1>

      {error && (
        <EmptyState
          compact
          icon={RefreshCw}
          className="mt-4"
          message={<span className="text-destructive">{error}</span>}
          action={<Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>}
        />
      )}

      <div className="sm:hidden">
        <MobileLibraryCategoryList
          counts={{
            books: loadingShelves ? "..." : books.length,
            authors: loadingShelves ? "..." : authorSummaries.length,
            series: loadingShelves ? "..." : seriesGroups.length,
            genres: loadingShelves ? "..." : genres.length,
            wishlist: loadingShelves ? "..." : wishlist.length,
          }}
        />
      </div>

      <div className="hidden sm:block">
        {loadingShelves ? (
          <LoadingIndicator label="Loading your library…" />
        ) : (
          <div className="rj-library-overview-shelves">
            <OverviewSection title="Books" count={books.length} to="/library/books" emptyMessage="Books you add will appear here.">
              <HorizontalShelf title="Books" bookRail>
                {sortedBooks.map((book) => (
                  <OverviewBookCard key={book.id} book={book} onOpen={openBook} />
                ))}
              </HorizontalShelf>
            </OverviewSection>

            <OverviewSection
              title="Authors"
              count={authorSummaries.length}
              to="/library/authors"
              emptyMessage="Authors will appear here after you add books or authors."
            >
              <HorizontalShelf title="Authors">
                {authorSummaries.map((author) => (
                  <AuthorShelfItem key={author.id} author={author} onOpen={openAuthor} />
                ))}
              </HorizontalShelf>
            </OverviewSection>

            <OverviewSection title="Series" count={seriesGroups.length} to="/library/series" emptyMessage="Series you add will appear here.">
              <HorizontalShelf title="Series">
                {seriesGroups.map((group) => (
                  <SeriesStackCard key={group.seriesId} group={group} onSeries={openSeries} variant="shelf" showBookCount={false} />
                ))}
              </HorizontalShelf>
            </OverviewSection>

            <OverviewSection title="Wishlist" count={wishlist.length} to="/library/wishlist" emptyMessage="Books you save for later will appear here.">
              <HorizontalShelf title="Wishlist" bookRail>
                {wishlist.map((book) => (
                  <OverviewBookCard key={book.id} book={book} onOpen={() => navigate("/library/wishlist")} />
                ))}
              </HorizontalShelf>
            </OverviewSection>

            <OverviewSection title="Genres" count={genres.length} to="/library/genres" emptyMessage="Genres will appear here after you add them.">
              <HorizontalShelf title="Genres">
                {recentGenres.map((genre) => (
                  <GenreShelfItem key={genre.id} genre={genre} slug={slugById.get(genre.id) ?? genre.id} />
                ))}
              </HorizontalShelf>
            </OverviewSection>
          </div>
        )}
      </div>

      <div className="sm:hidden">
        <OverviewSection
          title="Recently Added"
          count={booksLoading ? undefined : books.length}
          countUnit="book"
          emptyMessage="No books yet. Tap + to add one."
        >
          {booksLoading ? (
            <LoadingIndicator label="Loading your books…" />
          ) : (
            <RecentlyAddedPreview books={sortedBooks} onBook={openBook} />
          )}
        </OverviewSection>
      </div>
    </div>
  );
}
