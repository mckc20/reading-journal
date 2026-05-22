import { BookOpen, Heart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, statusVariant } from "@/lib/utils";
import type { Book } from "@/types";

interface LibraryBookCardProps {
  book: Book;
  onBook: (book: Book) => void;
  variant?: "grid" | "shelf";
}

function getProgress(book: Book): number | null {
  if (book.status !== "Reading") return null;

  const currentPage = Math.max(0, book.current_page ?? 0);
  const totalPages = Math.max(0, book.total_pages ?? 0);

  if (totalPages <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
}

export default function LibraryBookCard({
  book,
  onBook,
  variant = "grid",
}: LibraryBookCardProps) {
  const progress = getProgress(book);
  const isShelf = variant === "shelf";

  return (
    <button
      type="button"
      onClick={() => onBook(book)}
      className={cn(
        "group block rounded-lg text-left transition-shadow duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isShelf
          ? "w-full space-y-2"
          : "w-[110px] overflow-hidden border bg-background shadow-sm hover:shadow-md sm:w-[140px] dark:bg-card",
      )}
    >
      <div
        className={cn(
          "relative h-[135px] w-[90px] overflow-hidden bg-muted shadow-sm sm:h-[168px] sm:w-[112px]",
          isShelf && "rounded-md",
        )}
      >
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            className="absolute inset-0 block h-full w-full scale-[1.035] object-cover transition duration-200 ease-out group-hover:scale-[1.055]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        {book.is_favorite && (
          <Heart
            className="absolute right-2 top-2 h-4 w-4 fill-rose-500 text-rose-500 drop-shadow"
            aria-label="Favorite"
          />
        )}
      </div>

      {!isShelf && (
        <div className="min-w-0 space-y-2 p-2">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium leading-tight">{book.title}</p>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {book.authors.join(", ")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={statusVariant(book.status)} className="text-[10px]">
              {book.status}
            </Badge>
            {book.rating ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-current" />
                {book.rating}
              </span>
            ) : null}
          </div>
          {progress !== null && (
            <div className="space-y-1">
              <Progress value={progress} className="h-1" />
              <p className="text-[11px] text-muted-foreground">{progress}% read</p>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
