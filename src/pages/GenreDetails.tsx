import CollectionEmptyState from "@/components/CollectionEmptyState";
import { FilterSelect, LibrarySortingControls, LibraryFilterChips } from "@/components/LibraryControls";
import { sortDirectionLabel, type LibrarySort, type SortDirection } from "@/lib/librarySorting";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useId, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookCheck, BookOpen, BookOpenText, ChevronRight, Star } from "lucide-react";
import { DetailHero, DetailStat } from "@/components/redesign/DetailHero";
import { DetailBack, DetailSheet } from "@/components/redesign/DetailSheet";
import BookCard from "@/components/BookCard";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import { AppHeading, HeadingDescription } from "@/components/design";
import { GenreIllustration } from "@/components/genres/GenreVisuals";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { buildGenreSlugLookup, getBooksForGenreSubtree, getGenrePath, resolveGenreSlug } from "@/lib/genres";
import { filterAndSortGenreBooks, summarizeGenreBooks, type GenreBookSort } from "@/lib/genreCollection";
import { getGenreArtwork, getGenreMetadata } from "@/lib/genreMetadata";
import type { Book, BookStatus } from "@/types";

const genreSortOptions: Array<{ value: GenreBookSort; label: string; bookSort: LibrarySort }> = [
  { value: "title", label: "Title", bookSort: "title" },
  { value: "rating", label: "Rating", bookSort: "rating" },
  { value: "recently-finished", label: "Date Finished", bookSort: "date-finished" },
];
const statuses: BookStatus[] = ["To Read", "Up Next", "Reading", "Paused", "Finished", "DNF"];

function BooksGrid({ books, onBook }: { books: Book[]; onBook: (book: Book) => void }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
    {books.map((book) => <BookCard key={book.id} book={book} onClick={onBook} textSize="compact" />)}
  </div>;
}

const genreDetailLabel = "Genre details";
const genreFallback = "/library/genres";
export default function GenreDetails() {
  const { genreId } = useParams<{ genreId: string }>();
  return (
    <DetailSheet key={genreId} label={genreDetailLabel} fallbackTo={genreFallback}>
      {(close) => <GenreDetailsContent genreId={genreId} onClose={close} />}
    </DetailSheet>
  );
}

function GenreDetailsContent({ genreId, onClose }: { genreId?: string; onClose: () => void }) {
  const headingId = useId();
  const navigate = useNavigate();
  const { genres, loading: genresLoading, error: genresError } = useGenresContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const [selectedStatuses, setSelectedStatuses] = useState<BookStatus[]>([]);
  const [sort, setSort] = useState<GenreBookSort>("title");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const genre = genreId ? resolveGenreSlug(genreId, genres) : null;
  const slug = genre ? slugById.get(genre.id) ?? genre.id : "";
  const path = genre ? getGenrePath(genre.id, genres) : [];
  const matchingBooks = useMemo(() => genre ? getBooksForGenreSubtree(books, genre.id, genres) : [], [books, genre, genres]);
  const summary = summarizeGenreBooks(matchingBooks);
  const visibleBooks = filterAndSortGenreBooks(matchingBooks, selectedStatuses, sort, direction);
  const subgenres = genre ? genres.filter((item) => item.parent_id === genre.id)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })) : [];
  const onBook = (book: Book) => navigate(`/books/${book.id}`);

  const back = <DetailBack label={genreDetailLabel} fallbackTo={genreFallback} onClose={onClose} />;
  if (genresLoading || booksLoading) return <div className="rj-detail-page">{back}<LoadingIndicator variant="page" /></div>;
  if (genresError || booksError) return <div className="rj-detail-page">{back}<p role="alert" className="text-sm text-destructive">{genresError || booksError}</p></div>;
  if (!genre) return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <GenreIllustration slug="" />
      <AppHeading level={1}>Genre not found</AppHeading>
      {back}
    </div>
  );
  const metadata = getGenreMetadata(slug, genre.name, genre.is_system);

  return (
    <div className="rj-detail-page">
      <DetailHero
        titleId={headingId}
        color={genre.is_system ? getGenreArtwork(slug).heroColor : "#ead0d3"}
        navigation={back}
        actions={<DetailActionsMenu kind="genre" label={genre.name} />}
        artwork={<div className="rj-detail-genre-art"><GenreIllustration slug={slug} /></div>}
      >
        <div className="space-y-3">
          <nav className="relative z-10 flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm" aria-label="Breadcrumb">
            <Link to="/library/genres" className="rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Genres</Link>
            {path.map((item) => <span key={item.id} className="inline-flex items-center gap-1">
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
              {item.id === genre.id ? <span aria-current="page">{item.name}</span> :
                <Link to={`/genres/${slugById.get(item.id) ?? item.id}`} className="rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.name}</Link>}
            </span>)}
          </nav>
          <h1 id={headingId} className="rj-detail-title">{genre.name}</h1>
          <HeadingDescription>{metadata.description}</HeadingDescription>
        </div>
      </DetailHero>

      <div className="rj-detail-body">
        <section aria-labelledby={`${headingId}-summary`}>
          <div className="rj-detail-section-heading"><h2 id={`${headingId}-summary`}>Your reading summary</h2></div>
          <dl className="rj-reading-stats rj-genre-reading-stats">
            <DetailStat icon={BookOpen} label="Total books" value={summary.total} />
            <DetailStat icon={BookCheck} label="Finished" value={summary.finished} />
            <DetailStat icon={BookOpenText} label="Currently reading" value={summary.reading} />
            <DetailStat
              icon={Star}
              label="Average rating"
              value={summary.averageRating === null ? "No ratings yet" : `${summary.averageRating.toFixed(1)} / 5`}
              detail={`${summary.ratedCount} rated, finished book${summary.ratedCount === 1 ? "" : "s"}${summary.smallSample ? " · Small sample" : ""}`}
            />
          </dl>
        </section>

        {subgenres.length > 0 && <section className="space-y-4" aria-labelledby={`${headingId}-subgenres`}>
          <AppHeading level={2} id={`${headingId}-subgenres`}>Explore subgenres</AppHeading>
          <ul className="divide-y">
            {subgenres.map((subgenre) => {
              const subgenreSlug = slugById.get(subgenre.id) ?? subgenre.id;
              const count = getBooksForGenreSubtree(books, subgenre.id, genres).length;
              return (
                <li key={subgenre.id}>
                  <Link
                    to={`/genres/${subgenreSlug}`}
                    className="flex min-h-12 items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <GenreIllustration slug={subgenreSlug} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 break-words text-sm font-medium">{subgenre.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{count} book{count === 1 ? "" : "s"}</span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>}

        <section className="space-y-5" aria-labelledby={`${headingId}-books`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <AppHeading level={2} id={`${headingId}-books`}>Your books</AppHeading>
              <p role="status" className="text-sm text-muted-foreground">{visibleBooks.length} of {summary.total} book{summary.total === 1 ? "" : "s"}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <FilterSelect systemMenu label="Status" value={selectedStatuses} options={statuses} emptyLabel="All statuses"
                triggerClassName="w-[9.75rem]"
                onChange={(value) => setSelectedStatuses((current) => !value ? [] : current.includes(value as BookStatus)
                  ? current.filter((status) => status !== value) : [...current, value as BookStatus])} />
              <LibrarySortingControls systemMenu sort={sort}
                options={genreSortOptions.map((option) => ({ ...option, directionLabel: sortDirectionLabel(option.bookSort, option.value === "title" ? "asc" : "desc") }))}
                directionLabel={sortDirectionLabel(genreSortOptions.find((option) => option.value === sort)!.bookSort, direction)}
                onSortChange={(value) => { setSort(value as GenreBookSort); setDirection(value === "title" ? "asc" : "desc"); }}
                onDirectionChange={() => setDirection((current) => current === "asc" ? "desc" : "asc")} />
            </div>
          </div>
          <LibraryFilterChips chips={selectedStatuses.map((status) => ({ label: `Status: ${status}`, onRemove: () => setSelectedStatuses((current) => current.filter((value) => value !== status)) }))} onClear={() => setSelectedStatuses([])} />
          {visibleBooks.length > 0 ? <BooksGrid books={visibleBooks} onBook={onBook} /> :
            <CollectionEmptyState
              title={summary.total === 0 ? "A new chapter awaits" : "No books match your filters"}
              description={summary.total === 0 ? "Books you add to this genre will appear here." : "Try changing your filters to see more of your collection."}
              onShowAll={selectedStatuses.length > 0 ? () => setSelectedStatuses([]) : undefined}
            />}
        </section>
      </div>
    </div>
  );
}
