import { SegmentedControl } from "@/components/ui/segmented-control";
import { useChartEntrance } from "@/hooks/useChartEntrance";
import LoadingIndicator from "@/components/LoadingIndicator";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, Clock3, Timer, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppHeading } from "@/components/design";
import { cn } from "@/lib/utils";
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

function SummaryCard({
  title,
  children,
  className = "",
  compact = false,
  unframed = false,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  unframed?: boolean;
}) {
  if (unframed) {
    return (
      <section className={className}>
        {title && <AppHeading level={4} as="h2" className="text-muted-foreground">{title}</AppHeading>}
        <div className={title ? (compact ? "mt-3" : "mt-4") : ""}>{children}</div>
      </section>
    );
  }

  return (
    <section className={`rounded-xl border ${compact ? "p-4" : "p-5"} ${className}`}>
      {title && <AppHeading level={4} as="h2" className="text-muted-foreground">{title}</AppHeading>}
      <div className={title ? (compact ? "mt-3" : "mt-4") : ""}>{children}</div>
    </section>
  );
}

function StatsOverviewCard({
  icon: Icon,
  label,
  value,
  unavailableLabel,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode | null;
  unavailableLabel?: string;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 p-4">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {value === null && unavailableLabel ? (
          <p className="mt-1 text-xs text-muted-foreground">{unavailableLabel}</p>
        ) : (
          <p className="mt-1 font-heading text-xl font-semibold">{value ?? "--"}</p>
        )}
      </div>
    </div>
  );
}

function StatsBarChart({
  rows,
  emptyLabel,
  title,
  unframed = false,
}: {
  rows: Array<{ book: Book; value: number; formattedValue: string }>;
  emptyLabel: string;
  title?: string;
  unframed?: boolean;
}) {
  const motion = useChartEntrance<HTMLDivElement>();
  const maximumValue = Math.max(...rows.map((row) => row.value), 0);

  return (
    <SummaryCard compact unframed={unframed}>
      {title && <AppHeading level={4} as="h3" className="mb-4">{title}</AppHeading>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div {...motion} className={cn(unframed ? "divide-y divide-border" : "space-y-4")}>
          {rows.map((row, index) => (
            <div
              key={row.book.id}
              className={cn(
                "grid gap-2 sm:grid-cols-[minmax(8rem,0.9fr)_minmax(0,2fr)_auto] sm:items-center",
                unframed && "py-4 first:pt-0 last:pb-0",
              )}
            >
              <Link to={`/books/${row.book.id}`} className="min-w-0 text-sm font-medium hover:underline">
                <span className="line-clamp-2">{row.book.title}</span>
              </Link>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="rj-chart-bar rj-chart-bar-horizontal h-full rounded-full bg-primary"
                  style={{ width: `${maximumValue > 0 ? Math.max((row.value / maximumValue) * 100, 3) : 0}%`, animationDelay: `${index / rows.length * 150}ms` }}
                />
              </div>
              <p className="text-sm tabular-nums text-muted-foreground sm:text-right">{row.formattedValue}</p>
            </div>
          ))}
        </div>
      )}
    </SummaryCard>
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
  return (
    <div className="overflow-hidden rounded-xl border shadow-[var(--shadow-card)]">
      <div className="grid md:grid-cols-4">
        <div className="border-b md:border-b-0 md:border-r">
          <StatsOverviewCard
            icon={BookOpen}
            label="Pages Read"
            value={stats.overview.pagesRead === null ? null : stats.overview.pagesRead.toLocaleString()}
            unavailableLabel="Page progress is incomplete."
          />
        </div>
        <div className="border-b md:border-b-0 md:border-r">
          <StatsOverviewCard
            icon={Clock3}
            label="Hours Read"
            value={logsLoading ? <LoadingIndicator variant="inline" label="Loading reading time…" /> : logsError ? null : formatStatsReadingTime(stats.overview.readingMinutes)}
            unavailableLabel="Reading logs are unavailable."
          />
        </div>
        <div className="border-b md:border-b-0 md:border-r">
          <StatsOverviewCard
            icon={CalendarDays}
            label="Days Read"
            value={stats.overview.journeyDays !== null ? formatDaysSpent(stats.overview.journeyDays) : null}
            unavailableLabel="Reading dates are incomplete."
          />
        </div>
        <div>
          <StatsOverviewCard
            icon={Timer}
            label="Average Days per Book"
            value={stats.averageDaysPerBook === null ? null : `${stats.averageDaysPerBook.toFixed(1)} days`}
            unavailableLabel="No completed books with dates."
          />
        </div>
      </div>
    </div>
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
        key={mode}
        rows={getSpeedChartRows(stats, mode)}
        unframed
        emptyLabel={mode === "duration"
          ? "No books with start dates yet."
          : "Add reading time and page progress to compare reading speed."}
      />
    </section>
  );
}
