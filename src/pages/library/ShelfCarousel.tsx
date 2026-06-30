import { Children, type ReactNode, type WheelEvent } from "react";
import { cn } from "@/lib/utils";

interface ShelfCarouselProps {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  ariaLabel: string;
}

export default function ShelfCarousel({
  children,
  className,
  itemClassName,
  ariaLabel,
}: ShelfCarouselProps) {
  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaX;
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "-mx-4 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 pt-1 sm:-mx-2 sm:px-2",
        className,
      )}
      onWheel={handleWheel}
    >
      {Children.map(children, (child, index) => (
        <div key={index} className={cn("snap-start", itemClassName)}>
          {child}
        </div>
      ))}
    </div>
  );
}
