import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronRight, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { getGenrePath } from "@/lib/genres";

export default function GenreDetails() {
  const { genreId } = useParams<{ genreId: string }>();
  const { genres, loading: genresLoading, error: genresError } = useGenresContext();
  const { books, loading: booksLoading } = useBooksContext();
  const genre = genreId ? genres.find((item) => item.id === genreId) ?? null : null;
  const path = genre ? getGenrePath(genre.id, genres) : [];
  const parent = genre?.parent_id ? genres.find((item) => item.id === genre.parent_id) ?? null : null;
  const subgenres = genre ? genres.filter((item) => item.parent_id === genre.id) : [];
  const matchingBooks = genre
    ? books.filter((book) => book.genre_ids?.includes(genre.id))
    : [];

  if (genresLoading || booksLoading) {
    return (
      <div className="space-y-5">
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (genresError) {
    return <p className="text-sm text-destructive">{genresError}</p>;
  }

  if (!genre) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ListTree className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-lg font-heading leading-snug font-medium">Genre not found</h1>
        <Button asChild size="sm" variant="outline">
          <Link to="/library">Back to Library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="px-2">
        <Link to="/library">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Link>
      </Button>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {path.map((item, index) => (
            <span key={item.id} className="inline-flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
              {item.id === genre.id ? (
                <span>{item.name}</span>
              ) : (
                <Link to={`/genres/${item.id}`} className="hover:text-foreground">
                  {item.name}
                </Link>
              )}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-heading leading-tight font-medium">{genre.name}</h1>
          <Badge variant={genre.is_system ? "secondary" : "outline"}>
            {genre.is_system ? "System" : "Custom"}
          </Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-medium">Parent</h2>
          <div className="mt-3">
            {parent ? (
              <Button asChild variant="link" className="h-auto px-0">
                <Link to={`/genres/${parent.id}`}>{parent.name}</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">No parent</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-medium">Subgenres</h2>
          {subgenres.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {subgenres.map((item) => (
                <Button key={item.id} asChild size="sm" variant="outline">
                  <Link to={`/genres/${item.id}`}>{item.name}</Link>
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No subgenres yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-medium">Books</h2>
        {matchingBooks.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matchingBooks.map((book) => (
              <Link
                key={book.id}
                to={`/books/${book.id}`}
                className="flex min-w-0 gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/30"
              >
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium">{book.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {book.authors.join(", ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No books assigned to this genre yet.</p>
        )}
      </section>
    </div>
  );
}
