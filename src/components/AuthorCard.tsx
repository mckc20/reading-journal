import { BookOpen, Heart, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthorInitials } from "@/lib/authorShelf";
import { cn } from "@/lib/utils";
import type { AuthorSummary } from "@/lib/authorShelf";

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

interface AuthorCardProps {
  author: AuthorSummary;
  onClick: (author: AuthorSummary) => void;
  compact?: boolean;
  interactive?: boolean;
}

export default function AuthorCard({ author, onClick, compact = false, interactive = true }: AuthorCardProps) {
  const mostRecentBook = author.books[0];
  const previewBooks = author.coverBooks.slice(0, 3);

  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        "relative overflow-hidden pt-0 gap-0 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        interactive && "cursor-pointer",
        compact ? "rounded-xl" : "rounded-2xl",
      )}
      onClick={interactive ? () => onClick(author) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick(author);
              }
            }
          : undefined
      }
    >
      <CardContent className={cn("space-y-4 p-4", compact && "p-3")}>
        {author.isFavorite && (
          <Heart
            className="absolute right-4 top-4 h-5 w-5 fill-favorite text-favorite"
            aria-label="Favorite author"
          />
        )}

        <div className="flex items-start gap-4 pr-8">
          <div className={cn("relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-medium text-primary-foreground shadow-sm", compact && "h-14 w-14 text-lg")}>
            {author.photo_url ? (
              <img src={author.photo_url} alt={author.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-center text-base font-medium leading-none text-primary-foreground">
                {getAuthorInitials(author.name)}
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <p className="line-clamp-2 font-heading text-lg font-medium leading-snug">{author.name}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{countLabel(author.bookCount, "book")}</span>
              <span>{countLabel(author.quoteCount, "quote")}</span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-current text-rating" />
                {author.averageRating ?? "No rating"}
              </span>
            </div>
          </div>
        </div>

        {mostRecentBook && (
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">Most recent:</p>
              <p className="line-clamp-2 font-heading text-sm leading-snug">{mostRecentBook.title}</p>
            </div>
            <div className="flex w-40 shrink-0 justify-end -space-x-3">
              {previewBooks.map((book) => (
                <div
                  key={book.id}
                  className="block rounded-md ring-2 ring-card"
                  aria-hidden="true"
                >
                  <div className="h-24 w-16 overflow-hidden rounded-md border bg-muted shadow-sm">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <BookOpen className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
