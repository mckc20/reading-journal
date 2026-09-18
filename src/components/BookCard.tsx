import type { ReactNode } from "react";
import { BookCover, BookStatus } from "@/components/reading-journal";
import { Card } from "@/components/ui/card";
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
  selected?: boolean;
  onSelect?: (book: Book) => void;
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
  selected = false,
  onSelect,
}: BookCardProps) {
  const handleBook = onBook ?? onClick;
  const handleClick = onSelect ?? handleBook;
  const isShelf = variant === "shelf";
  const isPaused = book.status === "Paused";

  const content = (
    <>
      <BookCover
        src={book.cover_url}
        title={book.title}
        paused={isPaused}
        favorite={book.is_favorite}
        cornerLabel={cornerLabel}
        className={cn("w-full", !isShelf && "rounded-none")}
      />

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
    "group text-left",
    isShelf
      ? "block w-full space-y-2 transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      : "w-full gap-0 overflow-hidden pb-2 pt-0",
    selected && "ring-2 ring-primary ring-offset-2",
    className,
  );

  if (isShelf) {
    if (!handleBook) return <div className={classNames}>{content}</div>;

    return (
      <button type="button" onClick={() => handleBook(book)} className={classNames}>
        {content}
      </button>
    );
  }

  if (!handleClick) return <Card className={classNames}>{content}</Card>;

  return (
    <Card
      role="button"
      tabIndex={0}
      variant="interactive"
      className={classNames}
      onClick={() => handleClick(book)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick(book);
        }
      }}
    >
      {content}
    </Card>
  );
}
