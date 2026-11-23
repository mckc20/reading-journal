import { BookOpen, NotebookPen, Star, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { DetailStat } from "@/components/redesign/DetailHero";
import type { SeriesStats } from "@/lib/seriesDetails";
import type { Book } from "@/types";

type ScoredBook = { book: Book; value: number };

function SeriesBookStat({ icon, label, rows, emptyLabel, formatValue }: {
  icon: LucideIcon;
  label: string;
  rows: ScoredBook[];
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

export function SeriesBookHighlights({ stats }: { stats: SeriesStats }) {
  return (
    <dl className="rj-reading-stats" aria-label="Series book highlights">
      <SeriesBookStat icon={Star} label="Highest rated" rows={stats.rankings.rating}
        emptyLabel="No ratings yet" formatValue={(value) => value > 5 ? "Favorite" : `${value.toLocaleString()} / 5`} />
      <SeriesBookStat icon={BookOpen} label="Longest book" rows={stats.rankings.length}
        emptyLabel="No page totals yet" formatValue={(value) => `${value.toLocaleString()} pages`} />
      <SeriesBookStat icon={NotebookPen} label="Most annotated" rows={stats.rankings.annotations}
        emptyLabel="No annotations yet" formatValue={(value) => `${value.toLocaleString()} annotation${value === 1 ? "" : "s"}`} />
    </dl>
  );
}
