import { Children, useEffect, useState, type ReactNode, type WheelEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShelfDrag } from "@/hooks/useShelfDrag";
import { cn } from "@/lib/utils";

interface HorizontalShelfProps {
  title: string;
  children: ReactNode;
  className?: string;
  bookRail?: boolean;
}

/** Shared scrolling and arrow controls for every library shelf. */
export default function HorizontalShelf({ title, children, className, bookRail = false }: HorizontalShelfProps) {
  const itemCount = Children.count(children);
  const { ref: rowRef, ...drag } = useShelfDrag<HTMLDivElement>();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollButtons() {
    const row = rowRef.current;
    if (!row) return;

    setCanScrollLeft(row.scrollLeft > 1);
    setCanScrollRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
  }

  function scrollOneItem(direction: "left" | "right") {
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
  }, [itemCount]);

  return (
    <div className="relative">
      {canScrollLeft && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-sm"
          onClick={() => scrollOneItem("left")}
          aria-label={`Scroll ${title} left`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <div className={cn("rj-shelf-frame", bookRail ? "rj-home-shelf-frame" : "-mx-1")}>
        <div
          {...drag}
          ref={rowRef}
          role={bookRail ? "group" : undefined}
          tabIndex={bookRail ? 0 : undefined}
          aria-label={`${title} shelf`}
          className={cn(
            "rj-shelf-scroll overscroll-x-contain",
            bookRail ? "rj-shelf" : "isolate flex items-start gap-3 overflow-x-auto overflow-y-hidden px-1 py-3 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            className,
          )}
          onScroll={updateScrollButtons}
          onWheel={handleRowWheel}
        >
          {children}
        </div>
      </div>

      {canScrollRight && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-sm"
          onClick={() => scrollOneItem("right")}
          aria-label={`Scroll ${title} right`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
