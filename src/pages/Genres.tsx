import LoadingIndicator from "@/components/LoadingIndicator";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, Star } from "lucide-react";
import BackButton from "@/components/BackButton";
import { AppHeading, HeadingDescription } from "@/components/design";
import { GenreCollectionCard } from "@/components/genres/GenreVisuals";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { buildGenreSlugLookup, getGenreBookCounts, isGenreRoot } from "@/lib/genres";
import { getHighestRatedGenres, getMainGenreCollection } from "@/lib/genreCollection";
import type { GenreTreeNode } from "@/types";

function GenreTreeRow({ node, slugById, countsById }: {
  node: GenreTreeNode;
  slugById: Map<string, string>;
  countsById: ReturnType<typeof getGenreBookCounts>;
}) {
  const count = countsById.get(node.id)?.total ?? 0;
  return (
    <li>
      <Link to={`/genres/${slugById.get(node.id) ?? node.id}`}
        className="group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1 break-words font-medium">{node.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{count} book{count === 1 ? "" : "s"}</span>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Link>
      {node.children.length > 0 && (
        <ul className="ml-3 border-l pl-2 sm:ml-4">
          {node.children.map((child) => <GenreTreeRow key={child.id} node={child} slugById={slugById} countsById={countsById} />)}
        </ul>
      )}
    </li>
  );
}

export default function Genres() {
  const { genres, tree, loading: genresLoading, error: genresError } = useGenresContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const countsById = useMemo(() => getGenreBookCounts(genres, books), [genres, books]);
  const collection = useMemo(() => getMainGenreCollection(genres, books), [genres, books]);
  const highestRated = getHighestRatedGenres(collection);
  const populated = collection.filter((entry) => entry.total > 0);
  const rootSections = tree.filter(isGenreRoot);
  const legacyRoots = tree.filter((node) => !isGenreRoot(node));

  if (genresLoading || booksLoading) return <LoadingIndicator variant="page" />;
  if (genresError || booksError) return <p role="alert" className="text-sm text-destructive">{genresError || booksError}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <BackButton fallbackTo="/library" />
          <AppHeading level={1}>Genres</AppHeading>
        </div>
        <HeadingDescription className="max-w-xl">Your world of books</HeadingDescription>
      </header>

      {tree.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-16 text-center">
          <BookOpen aria-hidden="true" className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No genres are available yet.</p>
          <Button asChild size="sm" variant="outline"><Link to="/library">Back to Library</Link></Button>
        </div>
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="highest-rated-genres">
            <div className="space-y-1">
              <AppHeading level={2} id="highest-rated-genres">Your highest-rated genres</AppHeading>
              <HeadingDescription>Based on your rated, finished books.</HeadingDescription>
            </div>
            {highestRated.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {highestRated.map((entry) => (
                  <Link key={entry.genre.id} to={`/genres/${slugById.get(entry.genre.id) ?? entry.genre.id}`}
                    className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <h3 className="font-heading text-lg leading-snug">{entry.genre.name}</h3>
                    <div className="mt-auto space-y-1">
                      <p className="flex items-center gap-1.5"><Star aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" /><span className="text-xl font-medium">{entry.averageRating!.toFixed(1)}</span><span className="text-xs text-muted-foreground">/ 5</span></p>
                      <p className="text-xs text-muted-foreground">{entry.ratedCount} rated book{entry.ratedCount === 1 ? "" : "s"}</p>
                      {entry.smallSample && <p className="text-xs text-muted-foreground">Small sample</p>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Finish and rate a book to start discovering your favorite genres.</p>}
          </section>

          <section className="space-y-4" aria-labelledby="genre-collection">
            <AppHeading level={2} id="genre-collection">Explore your collection</AppHeading>
            {populated.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {populated.map((entry) => <GenreCollectionCard key={entry.genre.id} genre={entry.genre} slug={slugById.get(entry.genre.id) ?? entry.genre.id} books={entry.books} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed px-5 py-10 text-center">
                <BookOpen aria-hidden="true" strokeWidth={1} className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-heading text-lg">{books.length ? "More stories to discover" : "Your collection starts here"}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{books.length ? "Add main genres to your books to see them here. You can browse every genre below." : "As you add books and their genres, your personal collection will take shape here."}</p>
                {!books.length && <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/library">Go to Library</Link></Button>}
              </div>
            )}
          </section>

          <details className="group rounded-2xl border bg-card p-4 sm:p-6">
            <summary className="cursor-pointer rounded-md font-heading text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Explore all genres</summary>
            <p className="mb-5 mt-2 text-sm text-muted-foreground">Find your next direction, including genres you haven't explored yet.</p>
            <div className="grid items-start gap-6 md:grid-cols-2">
              {rootSections.map((section) => (
                <section key={section.id} className="space-y-2">
                  <h3 className="font-heading text-lg"><Link className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/genres/${slugById.get(section.id) ?? section.id}`}>{section.name.startsWith("Age Target") ? "Reading audiences" : section.name}</Link></h3>
                  <ul>{section.children.map((node) => <GenreTreeRow key={node.id} node={node} slugById={slugById} countsById={countsById} />)}</ul>
                </section>
              ))}
              {legacyRoots.length > 0 && <section className="space-y-2"><h3 className="font-heading text-lg">More from your library</h3><ul>{legacyRoots.map((node) => <GenreTreeRow key={node.id} node={node} slugById={slugById} countsById={countsById} />)}</ul></section>}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
