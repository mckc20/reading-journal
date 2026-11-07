import LoadingIndicator from "@/components/LoadingIndicator";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
import BackButton from "@/components/BackButton";
import { AppHeading, HeadingDescription } from "@/components/design";
import { GenreCollectionCard } from "@/components/genres/GenreVisuals";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { buildGenreSlugLookup } from "@/lib/genres";
import { getMainGenreCollection } from "@/lib/genreCollection";

export default function Genres() {
  const { genres, tree, loading: genresLoading, error: genresError } = useGenresContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const collection = useMemo(() => getMainGenreCollection(genres, books), [genres, books]);
  const populated = collection.filter((entry) => entry.total > 0);

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
          <section className="space-y-4" aria-labelledby="genre-collection">
            <div className="flex items-center justify-between gap-3">
              <AppHeading level={2} id="genre-collection">Explore your collection</AppHeading>
              <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs">
                <Link to="/library/genres/all">View all<ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
              </Button>
            </div>
            {populated.length ? (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {populated.map((entry) => <GenreCollectionCard key={entry.genre.id} genre={entry.genre} slug={slugById.get(entry.genre.id) ?? entry.genre.id} books={entry.books} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed px-5 py-10 text-center">
                <BookOpen aria-hidden="true" strokeWidth={1} className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-heading text-lg">{books.length ? "More stories to discover" : "Your collection starts here"}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{books.length ? "Add main genres to your books to see them here. Choose View all to browse every genre." : "As you add books and their genres, your personal collection will take shape here."}</p>
                {!books.length && <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/library">Go to Library</Link></Button>}
              </div>
            )}
          </section>

        </>
      )}
    </div>
  );
}
