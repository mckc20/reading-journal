import { BookOpen, Heart, PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, statusVariant } from "@/lib/utils";
import type { Book } from "@/types";

interface BookCardProps {
  book: Book;
  onBook?: (book: Book) => void;
  onClick?: (book: Book) => void;
  variant?: "grid" | "shelf";
  textSize?: "default" | "compact";
  cornerLabel?: string;
}

export default function BookCard({
  book,
  onBook,
  onClick,
  variant = "grid",
  cornerLabel,
}: BookCardProps) {
  const handleBook = onBook ?? onClick;
  const isShelf = variant === "shelf";
  const isPaused = book.status === "Paused";

  return (
    <button
      type="button"
      onClick={() => handleBook?.(book)}
      className={cn(
        "group block rounded-lg text-left transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isShelf
          ? "w-full space-y-2"
          : "w-full overflow-hidden border bg-background shadow-sm dark:bg-card",
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted shadow-sm",
          "aspect-[2/3] w-full",
          isShelf && "rounded-md",
          isPaused && "opacity-70",
        )}
      >
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            className={cn(
              "absolute inset-0 block h-full w-full object-cover object-top transition duration-200 ease-out group-hover:scale-[1.02]",
              isPaused && "grayscale",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
            <PauseCircle className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {book.is_favorite && (
          <Heart
            className="absolute right-2 top-2 h-4 w-4 fill-favorite text-favorite drop-shadow"
            aria-label="Favorite"
          />
        )}
        {cornerLabel && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">
            {cornerLabel}
          </span>
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
          </div>
        </div>
      )}
    </button>
  );
}
