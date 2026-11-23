import { SegmentedControl } from "@/components/ui/segmented-control";
import { useChartEntrance } from "@/hooks/useChartEntrance";
import LoadingIndicator from "@/components/LoadingIndicator";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, Clock3, Timer } from "lucide-react";
import { useState } from "react";
import { DetailStat } from "@/components/redesign/DetailHero";
import type { Book } from "@/types";
import type { SeriesStats } from "@/lib/seriesDetails";

type SpeedChartMode = "duration" | "speed";

function formatStatsReadingTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0 && remainingMinutes === 0) return "0h";
  if (hours === 0) return `${remainingMinutes}m`;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDaysSpent(days: number | null): string {
  if (days === null) return "--";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function StatsBarChart({
  rows,
  emptyLabel,
}: {
  rows: Array<{ book: Book; value: number; formattedValue: string }>;
  emptyLabel: string;
}) {
  const motion = useChartEntrance<HTMLDivElement>();
  const maximumValue = Math.max(...rows.map((row) => row.value), 0);

  return (
    <div {...motion} className="rj-chart-surface">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row, index) => (
            <div key={row.book.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                <Link to={`/books/${row.book.id}`} className="min-w-0 text-sm font-medium hover:underline">
                  <span className="line-clamp-2 wrap-anywhere">{row.book.title}</span>
                </Link>
                <p className="text-right text-xs tabular-nums text-muted-foreground">{row.formattedValue}</p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-background">
                <div
                  className="rj-chart-bar rj-chart-bar-horizontal h-full rounded-full bg-primary"
                  style={{ width: `${maximumValue > 0 ? Math.max((row.value / maximumValue) * 100, 3) : 0}%`, animationDelay: `${index / rows.length * 150}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SeriesAnalyticsOverview({
  stats,
  logsLoading,
  logsError,
}: {
  stats: SeriesStats;
  logsLoading: boolean;
  logsError: string | null;
}) {
  const { overview, averageDaysPerBook } = stats;
  return (
    <dl className="rj-reading-stats rj-series-insights-overview" aria-label="Series reading totals">
      <DetailStat
        icon={BookOpen}
        label="Pages read"
        value={overview.pagesRead?.toLocaleString() ?? "Not available"}
        detail={overview.pagesRead === null && "Page progress is incomplete."}
      />
      <DetailStat
        icon={Clock3}
        label="Hours read"
        value={logsLoading ? <LoadingIndicator variant="inline" label="Loading reading time…" /> : logsError ? "Not available" : formatStatsReadingTime(overview.readingMinutes)}
        detail={logsError && "Reading logs are unavailable."}
      />
      <DetailStat
        icon={CalendarDays}
        label="Days read"
        value={overview.journeyDays === null ? "Not available" : formatDaysSpent(overview.journeyDays)}
        detail={overview.journeyDays === null && "Reading dates are incomplete."}
      />
      <DetailStat
        icon={Timer}
        label="Average days per book"
        value={averageDaysPerBook === null ? "Not available" : `${averageDaysPerBook.toFixed(1)} days`}
        detail={averageDaysPerBook === null && "No completed books with dates."}
      />
    </dl>
  );
}

function getSpeedChartRows(stats: SeriesStats, mode: SpeedChartMode) {
  if (mode === "duration") {
    return stats.durationChart.map((row) => ({
      book: row.book,
      value: row.days,
      formattedValue: formatDaysSpent(row.days),
    }));
  }

  return stats.paceChart.map((row) => ({
    book: row.book,
    value: row.pagesPerHour,
    formattedValue: `${row.pagesPerHour.toFixed(1)} pages/hour`,
  }));
}

export function SeriesAnalyticsComparison({ stats }: { stats: SeriesStats }) {
  const [mode, setMode] = useState<SpeedChartMode>("speed");
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">Book comparisons</h3>
        <SegmentedControl<SpeedChartMode>
          label="Book comparison metric"
          value={mode}
          onChange={setMode}
          options={[
            { value: "speed", label: "Speed" },
            { value: "duration", label: "Duration" },
          ]}
        />
      </div>
      <StatsBarChart
        rows={getSpeedChartRows(stats, mode)}
        emptyLabel={mode === "duration"
          ? "No books with start dates yet."
          : "Add reading time and page progress to compare reading speed."}
      />
    </section>
  );
}
