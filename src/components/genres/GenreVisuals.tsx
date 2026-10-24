import { Link } from "react-router-dom";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { BookCover } from "@/components/reading-journal/BookCover";
import { AppHeading, HeadingDescription } from "@/components/design";
import { getGenreArtwork, getGenreMetadata } from "@/lib/genreMetadata";
import { selectGenreCovers, summarizeGenreBooks } from "@/lib/genreCollection";
import { cn } from "@/lib/utils";
import type { Book, Genre } from "@/types";

export function GenreIllustration({ slug, className }: { slug: string; className?: string }) {
  const artwork = getGenreArtwork(slug);
  const Icon = artwork.illustration;
  return <Icon aria-hidden="true" strokeWidth={0.8} className={cn("h-16 w-16", artwork.iconClassName, className)} />;
}

/** Decorative previews sit inside a genre link; individual books are opened in the collection. */
export function GenreCoverComposition({ books, compact = false }: { books: Book[]; compact?: boolean }) {
  const covers = selectGenreCovers(books);
  return (
    <div aria-hidden="true" className={cn("flex shrink-0 items-end justify-center -space-x-3 px-3", compact ? "h-20" : "mx-auto h-44 w-full max-w-80 sm:h-48")}>
      {covers.map((book, index) => (
        <BookCover key={book.id} src={book.cover_url} title={book.title} showFallbackTitle
          className={cn("shrink-0 origin-bottom border border-background/70 shadow-lg transition-transform duration-200 motion-reduce:transition-none",
            compact ? "w-11" : "w-[32%] max-w-28",
            index === 0 && covers.length > 1 && "-rotate-6",
            index === 1 && "z-10 -translate-y-2",
            index === 2 && "rotate-6")} />
      ))}
      {covers.length === 0 && <BookOpen strokeWidth={1} className={cn("text-muted-foreground/25", compact ? "h-10 w-10" : "h-16 w-16")} />}
    </div>
  );
}

export function GenreCollectionCard({ genre, slug, books, compact = false }: { genre: Genre; slug: string; books: Book[]; compact?: boolean }) {
  const metadata = getGenreMetadata(slug, genre.name, genre.is_system);
  const summary = summarizeGenreBooks(books);
  return (
    <Link to={`/genres/${slug}`} className={cn("group overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", compact && "flex items-center gap-3 p-4")}>
      {!compact && (
        <div className={cn("relative bg-gradient-to-br px-5 pb-5 pt-7", getGenreArtwork(slug).accentClassName)}>
          <GenreIllustration slug={slug} className="absolute right-4 top-4 h-12 w-12" />
          <GenreCoverComposition books={books} />
        </div>
      )}
      <div className={cn("min-w-0 flex-1 space-y-2", !compact && "p-5")}>
        <div className="flex items-start justify-between gap-2">
          <AppHeading level={compact ? 4 : 3} as="h3">{genre.name}</AppHeading>
          <ArrowUpRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        {!compact && <HeadingDescription className="min-h-10">{metadata.description}</HeadingDescription>}
        <p className="text-xs text-muted-foreground">{compact ? `${summary.total} book${summary.total === 1 ? "" : "s"}` : `${summary.finished} finished · ${summary.total} total`}</p>
      </div>
      {compact && <GenreCoverComposition books={books} compact />}
    </Link>
  );
}
