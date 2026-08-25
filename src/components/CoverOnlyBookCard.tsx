import { BookOpen, Heart, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

interface CoverOnlyBookCardProps {
  book: Book;
  onBook: (book: Book) => void;
  className?: string;
}

export default function CoverOnlyBookCard({ book, onBook, className }: CoverOnlyBookCardProps) {
  const isPaused = book.status === "Paused";

  return (
    <button
      type="button"
      onClick={() => onBook(book)}
      className={cn(
        "group min-w-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      aria-label={`Open ${book.title}`}
    >
      <div className={cn("relative aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm", isPaused && "opacity-70")}>
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt=""
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-transform group-hover:scale-[1.02]",
              isPaused && "grayscale",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
            <PauseCircle className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        {book.is_favorite && (
          <Heart
            className="absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-favorite text-favorite drop-shadow"
            aria-label="Favorite"
          />
        )}
      </div>
    </button>
  );
}

