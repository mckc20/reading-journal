import { BookOpen, Heart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { statusVariant } from "@/lib/utils";
import type { Book } from "@/types";
import type { ReactNode } from "react";

export type BookTimelineDateLabel = {
  year: string;
  month: string;
};

export type BookTimelineItem = {
  book: Book;
  dateLabel: BookTimelineDateLabel;
  subtitle?: string;
  details?: ReactNode;
  showDate?: boolean;
  showPoint?: boolean;
  showDivider?: boolean;
};

export default function BookTimeline({
  items,
  onBook,
}: {
  items: BookTimelineItem[];
  onBook: (book: Book) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="relative space-y-0">
      <span className="pointer-events-none absolute bottom-0 left-[1rem] top-0 w-px bg-border" />
      {items.map((item) => (
        <BookTimelineRow key={item.book.id} item={item} onBook={onBook} />
      ))}
    </div>
  );
}

function BookTimelineRow({
  item,
  onBook,
}: {
  item: BookTimelineItem;
  onBook: (book: Book) => void;
}) {
  const { book, dateLabel, details, subtitle, showDate = true, showPoint = true, showDivider = false } = item;

  return (
    <button
      type="button"
      onClick={() => onBook(book)}
      className="group relative grid w-full grid-cols-[2rem_4.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none sm:grid-cols-[2rem_5rem_minmax(0,1fr)_auto] sm:gap-5"
    >
      {showDivider && (
        <span className="pointer-events-none absolute bottom-0 left-[6.75rem] right-0 h-px bg-border/70" />
      )}
      <div className="relative flex h-full min-h-[4.5rem] items-center justify-center">
        {showPoint && (
          <span className="relative z-10 h-3 w-3 rounded-full border-2 border-primary bg-background transition-colors group-hover:border-muted-foreground" />
        )}
      </div>
      <div className={`space-y-0.5 text-sm text-muted-foreground ${showDate ? "" : "invisible"}`} aria-hidden={!showDate}>
        <div className="font-medium text-foreground">{dateLabel.month}</div>
        {dateLabel.year && <div className="text-xs tracking-[0.18em]">{dateLabel.year}</div>}
      </div>
      <div className="flex min-w-0 gap-3">
        <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm sm:h-[86px] sm:w-14">
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 font-heading text-base font-medium leading-snug">{book.title}</p>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-current text-rating" />
              {formatRating(book.rating)}
            </span>
            {book.is_favorite && <Heart className="h-4 w-4 fill-favorite text-favorite" />}
          </div>
          {details && <div className="pt-1">{details}</div>}
        </div>
      </div>
      <div className="flex items-start justify-end">
        <Badge variant={statusVariant(book.status)} className="text-[10px]">
          {book.status}
        </Badge>
      </div>
    </button>
  );
}

function formatRating(value: number | null | undefined): string {
  return value == null ? "-" : value.toFixed(1);
}
