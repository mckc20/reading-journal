import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  ListTree,
} from "lucide-react";
import BookCard from "@/components/BookCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { buildGenreSlugLookup, getBooksForGenreSubtree, getGenreBookCount, getGenrePath, resolveGenreSlug } from "@/lib/genres";
import { getGenreMetadata } from "@/lib/genreMetadata";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function sortBooksByTitle(books: Book[]): Book[] {
  return [...books].sort((a, b) => {
    return compareText(a.title, b.title);
  });
}

function BooksGrid({ books, onBook }: { books: Book[]; onBook: (book: Book) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={onBook} textSize="compact" />
      ))}
    </div>
  );
}

export default function GenreDetails() {
  const { genreId } = useParams<{ genreId: string }>();
  const navigate = useNavigate();
  const { genres, loading: genresLoading, error: genresError } = useGenresContext();
  const { books, loading: booksLoading } = useBooksContext();

  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const genre = genreId ? resolveGenreSlug(genreId, genres) : null;
  const slug = genre ? slugById.get(genre.id) ?? genre.id : "";
  const path = genre ? getGenrePath(genre.id, genres) : [];
  const metadata = genre ? getGenreMetadata(slug, genre.name, genre.is_system) : null;
  const subgenres = genre ? genres.filter((item) => item.parent_id === genre.id) : [];
  const matchingBooks = genre ? sortBooksByTitle(getBooksForGenreSubtree(books, genre.id, genres)) : [];
  const genreCount = genre ? getGenreBookCount(genre.id, books, genres) : null;

  if (genresLoading || booksLoading) {
    return (
      <div className="space-y-5">
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (genresError) {
    return <p className="text-sm text-destructive">{genresError}</p>;
  }

  if (!genre || !metadata || !genreCount) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ListTree className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-lg font-heading leading-snug font-medium">Genre not found</h1>
        <Button asChild size="sm" variant="outline">
          <Link to="/genres">Back to Genres</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <Button variant="ghost" size="sm" className="px-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back
      </Button>

      <section className={cn("overflow-hidden rounded-xl border bg-card", metadata.accentClassName)}>
        <div className={cn("bg-gradient-to-br p-5", metadata.accentClassName ?? "from-primary/10 via-accent/10 to-muted/20")}>
          <div className="space-y-5">
            <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
              <Link to="/genres" className="hover:text-foreground">Genres</Link>
              {path.map((item) => {
                const itemSlug = slugById.get(item.id) ?? item.id;
                return (
                  <span key={item.id} className="inline-flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5" />
                    {item.id === genre.id ? (
                      <span>{item.name}</span>
                    ) : (
                      <Link to={`/genres/${itemSlug}`} className="hover:text-foreground">
                        {item.name}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-heading leading-tight font-medium">{genre.name}</h1>
                <Badge variant={genre.is_system ? "secondary" : "outline"}>
                  {genre.is_system ? "System" : "Custom"}
                </Badge>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{metadata.description}</p>
            </div>

            <div className="grid max-w-xl grid-cols-3 overflow-hidden rounded-xl border bg-background/75">
              <div className="border-r p-4">
                <p className="text-xs text-muted-foreground">Total books</p>
                <p className="mt-1 text-2xl font-semibold">{genreCount.total}</p>
              </div>
              <div className="border-r p-4">
                <p className="text-xs text-muted-foreground">Tagged here</p>
                <p className="mt-1 text-2xl font-semibold">{genreCount.direct}</p>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground">Subgenres</p>
                <p className="mt-1 text-2xl font-semibold">{subgenres.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {subgenres.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-heading leading-snug font-medium">Subgenres</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subgenres.map((subgenre) => {
              const count = getGenreBookCount(subgenre.id, books, genres).total;
              const subgenreSlug = slugById.get(subgenre.id) ?? subgenre.id;
              return (
                <Link
                  key={subgenre.id}
                  to={`/genres/${subgenreSlug}`}
                  className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{subgenre.name}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {count} book{count === 1 ? "" : "s"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-heading leading-snug font-medium">Books</h2>
          <p className="text-sm text-muted-foreground">
            {matchingBooks.length} matching book{matchingBooks.length === 1 ? "" : "s"}.
          </p>
        </div>

        {matchingBooks.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No books assigned to this genre yet.
          </div>
        ) : (
          <BooksGrid books={matchingBooks} onBook={(book) => navigate(`/books/${book.id}`)} />
        )}
      </section>
    </div>
  );
}
