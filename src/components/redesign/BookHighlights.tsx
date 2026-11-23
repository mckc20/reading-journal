import { BookOpen, Heart, NotebookPen, Star, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { DetailStat } from "@/components/redesign/DetailHero";
import { BookCover } from "@/components/reading-journal/BookCover";
import BookRating from "@/components/reading-journal/BookRating";
import HorizontalShelf from "@/pages/library/HorizontalShelf";
import type { BookRankings, RankedBook } from "@/lib/bookRankings";
import type { Book } from "@/types";
import "./redesign.css";

function BookHighlightStat({ icon, label, rows, emptyLabel, formatValue }: {
  icon: LucideIcon;
  label: string;
  rows: RankedBook[];
  emptyLabel: string;
  formatValue: (value: number) => string;
}) {
  const highest = rows[0]?.value;
  if (highest === undefined) return <DetailStat icon={icon} label={label} value={emptyLabel} />;

  const winners = rows.filter((row) => row.value === highest);
  return (
    <DetailStat
      icon={icon}
      label={label}
      value={(
        <ul className="space-y-1">
          {winners.map(({ book }) => (
            <li key={book.id}>
              <Link to={`/books/${encodeURIComponent(book.id)}`} className="wrap-anywhere underline-offset-4 hover:underline focus-visible:underline">
                {book.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      detail={formatValue(highest)}
    />
  );
}

function RatedBookCard({ book }: { book: Book }) {
  const rating = book.rating ?? null;
  return (
    <Link to={`/books/${encodeURIComponent(book.id)}`} className="rj-reading-card rj-highest-rated-card">
      <BookCover src={book.cover_url} title={book.title} decorative />
      <span className="rj-reading-card-copy">
        <span className="rj-book-title">{book.title}</span>
        {rating !== null ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <BookRating rating={rating} />
            <span aria-hidden="true">{rating.toLocaleString()} / 5</span>
          </span>
        ) : <span className="mt-1 block text-xs text-muted-foreground">No rating</span>}
        {book.is_favorite && (
          <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Heart aria-hidden="true" className="size-3 fill-favorite text-favorite" />
            Favorite
          </span>
        )}
      </span>
    </Link>
  );
}

function HighestRatedStat({ rows }: { rows: RankedBook[] }) {
  const winners = rows.filter((row) => row.value === rows[0]?.value);
  const [first] = winners;

  return (
    <DetailStat
      icon={Star}
      label="Highest rated"
      className="rj-highest-rated-stat"
      value={first ? (
        winners.length === 1 ? <RatedBookCard book={first.book} /> : (
          <HorizontalShelf title="Highest rated">
            {winners.map(({ book }) => (
              <Link
                key={book.id}
                data-shelf-item
                to={`/books/${encodeURIComponent(book.id)}`}
                aria-label={book.title}
                className="w-24 shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <BookCover src={book.cover_url} title={book.title} decorative />
              </Link>
            ))}
          </HorizontalShelf>
        )
      ) : "No ratings yet"}
    />
  );
}

export function BookHighlights({ rankings, label }: { rankings: BookRankings; label: string }) {
  return (
    <dl className="rj-reading-stats rj-book-highlights" aria-label={label}>
      <HighestRatedStat rows={rankings.rating} />
      <BookHighlightStat icon={BookOpen} label="Longest book" rows={rankings.length}
        emptyLabel="No page totals yet" formatValue={(value) => `${value.toLocaleString()} pages`} />
      <BookHighlightStat icon={NotebookPen} label="Most annotated" rows={rankings.annotations}
        emptyLabel="No annotations yet" formatValue={(value) => `${value.toLocaleString()} annotation${value === 1 ? "" : "s"}`} />
    </dl>
  );
}
