import type { CSSProperties } from "react";
import { BookOpen } from "lucide-react";
import { BookCover } from "@/components/reading-journal/BookCover";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import { cn } from "@/lib/utils";
import type { BookStatus } from "@/types";
import "./series-cards.css";

export interface SeriesCoverBook {
  id?: string;
  title: string;
  cover_url?: string | null;
  status?: BookStatus;
}

export function SeriesCoverStack({ books, className, fallback, showPaused, frameless }: {
  books: readonly SeriesCoverBook[];
  className?: string;
  fallback?: SeriesCoverBook;
  showPaused?: boolean;
  frameless?: boolean;
}) {
  const availableCovers = books.filter(book => book.cover_url);
  const covers = frameless ? availableCovers : availableCovers.slice(0, 3);
  if (covers.length === 0 && fallback?.cover_url) covers.push(fallback);
  const color = useBookHeroColor(frameless ? undefined : covers[0]?.cover_url);
  const coverStrip = frameless && covers.length > 1;

  return (
    <div className={cn("rj-series-cover-stack", frameless && "rj-series-cover-stack--frameless", className)}
      data-cover-count={covers.length} aria-hidden={!coverStrip || undefined}
      style={!frameless && covers.length ? { "--book-detail-hero-color": color } as CSSProperties : undefined}>
      <div className="rj-series-cover-mat"
        tabIndex={coverStrip ? 0 : undefined}
        role={coverStrip ? "region" : undefined}
        aria-label={coverStrip ? "Series covers" : undefined}
        onKeyDown={coverStrip ? event => {
          const strip = event.currentTarget;
          if (strip.scrollWidth <= strip.clientWidth || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          const direction = event.key === "ArrowLeft" ? -1 : 1;
          strip.scrollBy({ left: direction * strip.clientWidth / 2 });
        } : undefined}>
        {covers.length ? (
          <div className="rj-series-cover-layers" data-count={covers.length}>
            {covers.map((book, index) => (
              <div className="rj-series-cover-layer" key={book.id ?? index}
                style={{ "--cover-position": index, zIndex: covers.length - index } as CSSProperties}>
                <BookCover src={book.cover_url} title={book.title} decorative
                  paused={showPaused && index === 0 && book.status === "Paused"} />
              </div>
            ))}
          </div>
        ) : <BookOpen size={38} strokeWidth={1.2} />}
      </div>
    </div>
  );
}
