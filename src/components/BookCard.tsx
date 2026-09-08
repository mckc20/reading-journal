import type { ReactNode } from "react";
import { BookCover, BookStatus } from "@/components/reading-journal";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

interface BookCardProps {
  book: Book;
  onBook?: (book: Book) => void;
  onClick?: (book: Book) => void;
  variant?: "grid" | "shelf";
  textSize?: "default" | "compact";
  cornerLabel?: string;
  showAuthor?: boolean;
  footer?: ReactNode;
  className?: string;
}

export default function BookCard({
  book,
  onBook,
  onClick,
  variant = "grid",
  cornerLabel,
  showAuthor = true,
  footer,
  className,
}: BookCardProps) {
  const handleBook = onBook ?? onClick;
  const isShelf = variant === "shelf";
  const isPaused = book.status === "Paused";

  const content = (
    <>
      <div
        className={cn(
          "w-full",
          !isShelf && "overflow-hidden",
        )}
      >
        <BookCover
          src={book.cover_url}
          title={book.title}
          paused={isPaused}
          favorite={book.is_favorite}
          cornerLabel={cornerLabel}
          className={cn(!isShelf && "rounded-none")}
        />
      </div>

      {!isShelf && (
        <div className="min-w-0 space-y-2 p-2">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium leading-tight">{book.title}</p>
            {showAuthor && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {book.authors.join(", ")}
              </p>
            )}
          </div>

          {footer ?? (
            <div className="flex flex-wrap items-center gap-1.5">
              <BookStatus status={book.status} className="text-[10px]" />
            </div>
          )}
        </div>
      )}
    </>
  );

  const classNames = cn(
    "group block rounded-lg text-left transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isShelf
      ? "w-full space-y-2"
      : "w-full overflow-hidden border bg-background shadow-sm dark:bg-card",
    className,
  );

  if (!handleBook) return <div className={classNames}>{content}</div>;

  return (
    <button type="button" onClick={() => handleBook(book)} className={classNames}>
      {content}
    </button>
  );
}
