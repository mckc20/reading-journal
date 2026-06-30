import { useEffect, useRef, useState, type WheelEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Book } from "@/types";
import LibraryBookCard from "./LibraryBookCard";

interface BookShelfProps {
  title: string;
  books: Book[];
  onBook: (book: Book) => void;
  onViewAll?: () => void;
  emptyMessage?: string;
}

export default function BookShelf({
  title,
  books,
  onBook,
  onViewAll,
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

  function handleRowWheel(event: WheelEvent<HTMLDivElement>) {
    const row = rowRef.current;
    if (!row) return;

    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

    const rawDelta = event.deltaX;
    if (rawDelta === 0) return;

    const scrollLeft = row.scrollLeft;
    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    const canMoveLeft = rawDelta < 0 && scrollLeft > 1;
    const canMoveRight = rawDelta > 0 && scrollLeft < maxScrollLeft - 1;

    if (!canMoveLeft && !canMoveRight) return;

    event.preventDefault();
    row.scrollBy({
      left: rawDelta,
      behavior: "auto",
    });
  }

  useEffect(() => {
    updateScrollButtons();

    const row = rowRef.current;
    if (!row) return;

    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(row);

    return () => resizeObserver.disconnect();
  }, [books.length]);

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
            className="flex gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={updateScrollButtons}
            onWheel={handleRowWheel}
          >
            {books.map((book) => (
              <div key={book.id} data-shelf-item className="shrink-0 basis-[90px] sm:basis-[112px]">
                <LibraryBookCard book={book} onBook={onBook} variant="shelf" />
              </div>
            ))}
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
        <div className="rounded-lg border border-dashed bg-background/55 p-4 text-sm text-muted-foreground">
          <span>{emptyMessage}</span>
        </div>
      )}
    </section>
  );
}
