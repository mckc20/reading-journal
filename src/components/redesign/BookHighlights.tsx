import { BookOpen, NotebookPen, Star, type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { DetailStat } from "@/components/redesign/DetailHero";
import type { BookRankings, RankedBook } from "@/lib/bookRankings";

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

function HighestRatedStat({ rows }: { rows: RankedBook[] }) {
  const highest = rows[0]?.value;
  const winners = rows.filter((row) => row.value === highest);
  const rating = highest !== undefined && winners.length === 1
    ? highest > 5 ? "Favorite" : `${highest.toLocaleString()} / 5`
    : undefined;

  return (
    <DetailStat
      icon={Star}
      label="Highest rated"
      className="rj-highest-rated-stat"
      value={winners.length > 0 ? (
        <span className="wrap-anywhere">
          {winners.map(({ book }, index) => (
            <Fragment key={book.id}>
              {index > 0 && ", "}
              <Link to={`/books/${encodeURIComponent(book.id)}`} className="underline-offset-4 hover:underline focus-visible:underline">
                {book.title}
              </Link>
            </Fragment>
          ))}
        </span>
      ) : "No ratings yet"}
      detail={rating}
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
