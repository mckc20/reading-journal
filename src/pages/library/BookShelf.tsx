import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Book } from "@/types";
import LibraryBookCard from "./LibraryBookCard";

interface BookShelfProps {
  title: string;
  books: Book[];
  onBook: (book: Book) => void;
  onViewAll?: () => void;
  onAddBook?: () => void;
  emptyMessage?: string;
}

export default function BookShelf({
  title,
  books,
  onBook,
  onViewAll,
  onAddBook,
  emptyMessage = "No books here yet.",
}: BookShelfProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollButtons() {
    const row = rowRef.current;
    if (!row) return;

    setCanScrollLeft(row.scrollLeft > 1);
    setCanScrollRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
  }

  function scrollOneBook(direction: "left" | "right") {
    const row = rowRef.current;
    const firstItem = row?.querySelector<HTMLElement>("[data-shelf-item]");
    if (!row || !firstItem) return;

    const gap = parseFloat(getComputedStyle(row).columnGap || "0");
    const step = firstItem.offsetWidth + gap;

    row.scrollBy({
      left: direction === "right" ? step : -step,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    updateScrollButtons();

    const row = rowRef.current;
    if (!row) return;

    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(row);

    return () => resizeObserver.disconnect();
  }, [books.length, onAddBook]);

  return (
    <section className="min-w-0 border-b px-4 py-3 last:border-b-0 sm:px-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold leading-snug">{title}</h3>
            <p className="text-xs text-muted-foreground">{books.length}</p>
          </div>
        </div>
        {onViewAll && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onViewAll}>
            View all
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      {books.length > 0 ? (
        <div className="relative">
          {canScrollLeft && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-sm"
              onClick={() => scrollOneBook("left")}
              aria-label={`Scroll ${title} left`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div
            ref={rowRef}
            aria-label={`${title} shelf`}
            className="flex gap-3 overflow-hidden scroll-smooth"
            onScroll={updateScrollButtons}
          >
            {books.map((book) => (
              <div key={book.id} data-shelf-item className="shrink-0 basis-[90px] sm:basis-[112px]">
                <LibraryBookCard book={book} onBook={onBook} variant="shelf" />
              </div>
            ))}
            {onAddBook && (
              <button
                type="button"
                data-shelf-item
                onClick={onAddBook}
                className="flex h-[135px] w-[90px] shrink-0 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/20 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-[168px] sm:w-[112px]"
                aria-label={`Add a book to ${title}`}
              >
                <Plus className="h-6 w-6" />
                <span className="text-center text-[11px] font-medium">Add a book</span>
              </button>
            )}
          </div>

          {canScrollRight && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-sm"
              onClick={() => scrollOneBook("right")}
              aria-label={`Scroll ${title} right`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-background/55 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{emptyMessage}</span>
          {onAddBook && (
            <Button type="button" variant="outline" size="sm" onClick={onAddBook}>
              <Plus className="h-4 w-4" />
              Add a book
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
