import { BookOpen, ChevronRight, NotebookPen, Star, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SeriesStats } from "@/lib/seriesDetails";
import type { Book } from "@/types";

type ScoredBook = { book: Book; value: number };

function topBooks(rows: ScoredBook[]) {
  const highest = rows.reduce((best, row) => Math.max(best, row.value), Number.NEGATIVE_INFINITY);
  return rows.filter((row) => row.value === highest);
}

function SeriesBookStat({ icon: Icon, label, rows, emptyLabel, formatValue }: {
  icon: LucideIcon;
  label: string;
  rows: ScoredBook[];
  emptyLabel: string;
  formatValue: (value: number) => string;
}) {
  const winners = topBooks(rows);
  const first = winners[0];

  if (!first) {
    return (
      <div className="rj-reading-stat rj-reading-stat-static">
        <span className="rj-reading-stat-label"><Icon aria-hidden="true" />{label}</span>
        <span className="rj-reading-stat-value">{emptyLabel}</span>
      </div>
    );
  }

  const score = formatValue(first.value);
  const tied = winners.length > 1;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="rj-reading-stat">
          <Icon aria-hidden="true" />
          <span className="min-w-0 wrap-anywhere">
            <span className="rj-reading-stat-label">{label}</span>
            <span className="rj-reading-stat-value">{first.book.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {score}{tied && ` · ${winners.length} tied`}
            </span>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="pr-7">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{tied ? `${winners.length} books tied at ${score}` : score}</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-xl bg-card">
          {winners.map(({ book }) => (
            <li key={book.id}>
              <DialogClose asChild>
                <Link to={`/books/${encodeURIComponent(book.id)}`} className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-4 py-3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                  <span className="min-w-0 wrap-anywhere">{book.title}</span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ring" />
                </Link>
              </DialogClose>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function SeriesBookHighlights({ stats }: { stats: SeriesStats }) {
  // The legacy ranking gives favorites a special score. This stat uses the numeric rating.
  const ratedBooks = stats.rankings.rating.flatMap(({ book }) => (
    typeof book.rating === "number" && Number.isFinite(book.rating) ? [{ book, value: book.rating }] : []
  ));

  return (
    <div className="rj-reading-stats" role="group" aria-label="Series book highlights">
      <SeriesBookStat icon={Star} label="Highest rated" rows={ratedBooks}
        emptyLabel="No ratings yet" formatValue={(value) => `${value.toLocaleString()} / 5`} />
      <SeriesBookStat icon={BookOpen} label="Longest book" rows={stats.rankings.length}
        emptyLabel="No page totals yet" formatValue={(value) => `${value.toLocaleString()} pages`} />
      <SeriesBookStat icon={NotebookPen} label="Most annotated" rows={stats.rankings.annotations}
        emptyLabel="No annotations yet" formatValue={(value) => `${value.toLocaleString()} annotation${value === 1 ? "" : "s"}`} />
    </div>
  );
}
