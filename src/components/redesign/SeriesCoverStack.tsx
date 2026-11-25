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

export function SeriesCoverStack({ books, className, fallback, showPaused }: {
  books: readonly SeriesCoverBook[];
  className?: string;
  fallback?: SeriesCoverBook;
  showPaused?: boolean;
}) {
  const covers = books.filter(book => book.cover_url).slice(0, 3);
  if (covers.length === 0 && fallback?.cover_url) covers.push(fallback);
  const color = useBookHeroColor(covers[0]?.cover_url);

  return (
    <div className={cn("rj-series-cover-stack", className)} aria-hidden="true"
      style={covers.length ? { "--book-detail-hero-color": color } as CSSProperties : undefined}>
      <div className="rj-series-cover-mat">
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
