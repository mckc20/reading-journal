import { Link } from "react-router-dom";
import { BarChart3, BookOpen, CalendarDays, Clock3, PauseCircle, Podium, Timer, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AppHeading } from "@/components/design";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";
import type { SeriesStats } from "@/lib/seriesDetails";

type SpeedChartMode = "duration" | "speed";
type RankingMode = "rating" | "length" | "annotations";

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
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={`rounded-xl border bg-card ${compact ? "p-4" : "p-5"} ${className}`}>
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
        <p className="mt-1 font-heading text-xl font-semibold">{value ?? "--"}</p>
        {value === null && unavailableLabel && (
          <p className="mt-2 text-xs text-muted-foreground">{unavailableLabel}</p>
        )}
      </div>
    </div>
  );
}

function BookThumbnail({ book }: { book: Book }) {
  const isPaused = book.status === "Paused";

  return (
    <div
      className={cn(
        "relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted shadow-sm",
        isPaused && "opacity-70",
      )}
    >
      {book.cover_url ? (
        <img
          src={book.cover_url}
          alt=""
          loading="lazy"
          className={cn("h-full w-full object-cover", isPaused && "grayscale")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <BookOpen className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
          <PauseCircle className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function SegmentedControl<TValue extends string>({
  value,
  options,
  onChange,
}: {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium",
            option.value === value && "bg-primary/80 text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function StatsBarChart({
  rows,
  emptyLabel,
  title,
}: {
  rows: Array<{ book: Book; value: number; formattedValue: string }>;
  emptyLabel: string;
  title?: string;
}) {
  const maximumValue = Math.max(...rows.map((row) => row.value), 0);

  return (
    <SummaryCard compact>
      {title && <AppHeading level={4} as="h3" className="mb-4">{title}</AppHeading>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.book.id} className="grid gap-2 sm:grid-cols-[minmax(8rem,0.9fr)_minmax(0,2fr)_auto] sm:items-center">
              <Link to={`/books/${row.book.id}`} className="min-w-0 text-sm font-medium hover:underline">
                <span className="line-clamp-2">{row.book.title}</span>
              </Link>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${maximumValue > 0 ? Math.max((row.value / maximumValue) * 100, 3) : 0}%` }}
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

function getRankingGroups(
  rows: Array<{ book: Book; value: number }>,
  getTieKey: (row: { book: Book; value: number }) => string | number,
): Array<{ rank: number; key: string | number; value: number; rows: Array<{ book: Book; value: number }> }> {
  return rows.reduce<
    Array<{ key: string | number; value: number; rows: Array<{ book: Book; value: number }> }>
  >((groups, row) => {
    const key = getTieKey(row);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.key === key) {
      lastGroup.rows.push(row);
    } else {
      groups.push({ key, value: row.value, rows: [row] });
    }
    return groups;
  }, []).map((group, index) => ({ ...group, rank: index + 1 }));
}

function PodiumBookLink({
  book,
  metadata,
}: {
  book: Book;
  metadata: string;
}) {
  return (
    <Link to={`/books/${book.id}`} className="block min-w-0 rounded-md p-1.5 transition-colors hover:bg-background/70">
      <p className="text-sm font-medium leading-snug">{book.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{metadata}</p>
    </Link>
  );
}

function PodiumCoverStack({ books }: { books: Book[] }) {
  return (
    <div className="flex min-h-20 flex-wrap items-end justify-center gap-2">
      {books.slice(0, 4).map((book) => (
        <BookThumbnail key={book.id} book={book} />
      ))}
      {books.length > 4 && (
        <span className="mb-1 rounded-full border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground">
          +{books.length - 4}
        </span>
      )}
    </div>
  );
}

function PodiumColumn({
  group,
  formatValue,
}: {
  group: ReturnType<typeof getRankingGroups>[number] | undefined;
  formatValue: (value: number, book: Book) => string;
}) {
  const rank = group?.rank ?? null;
  const heightClass = rank === 1 ? "min-h-72" : rank === 2 ? "min-h-60" : "min-h-52";

  return (
    <div className="relative flex min-w-0 flex-1 flex-col justify-end overflow-visible pt-20">
      {group && (
        <div className="absolute inset-x-0 -top-2 z-10">
          <PodiumCoverStack books={group.rows.map((row) => row.book)} />
        </div>
      )}
      <div
        className={cn(
          "overflow-visible rounded-t-xl border bg-muted/45 p-3 text-center",
          heightClass,
          rank === 1 && "border-primary/40 bg-primary/10",
        )}
      >
        <div className={cn("mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border bg-card text-sm font-semibold", rank === 1 && "border-primary text-primary")}>
          {rank ? `#${rank}` : "--"}
        </div>
        {group ? (
          <div className="space-y-2">
            {group.rows.map((row) => (
              <PodiumBookLink key={row.book.id} book={row.book} metadata={formatValue(row.value, row.book)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No book yet</p>
        )}
      </div>
    </div>
  );
}

function SeriesRankingPodium({
  rows,
  formatValue,
  emptyLabel,
  getTieKey = (row) => row.value,
}: {
  rows: Array<{ book: Book; value: number }>;
  formatValue: (value: number, book: Book) => string;
  emptyLabel: string;
  getTieKey?: (row: { book: Book; value: number }) => string | number;
}) {
  const rankingGroups = getRankingGroups(rows, getTieKey);
  const first = rankingGroups[0];
  const second = rankingGroups[1];
  const third = rankingGroups[2];
  const remainingGroups = rankingGroups.slice(3);
  const hasRemainingGroups = remainingGroups.length > 0;

  return (
    <SummaryCard compact>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-4 overflow-visible">
          <div className="overflow-visible">
            <div className="grid grid-cols-3 items-end gap-2 overflow-visible sm:gap-4">
              <PodiumColumn group={second} formatValue={formatValue} />
              <PodiumColumn group={first} formatValue={formatValue} />
              <PodiumColumn group={third} formatValue={formatValue} />
            </div>
            {hasRemainingGroups && (
              <ol className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2 px-3">
                {remainingGroups.map((group) => (
                  <li key={`${group.rank}-${group.key}`}>
                    <div className="flex max-w-72 items-start gap-2 rounded-lg border bg-background px-3 py-2 text-left shadow-sm">
                      <span className="shrink-0 text-sm font-semibold text-primary">#{group.rank}</span>
                      <div className="min-w-0 space-y-1">
                        {group.rows.map((row) => (
                          <Link key={row.book.id} to={`/books/${row.book.id}`} className="block min-w-0 rounded-sm hover:text-primary">
                            <p className="truncate text-xs font-medium">{row.book.title}</p>
                            <p className="text-xs text-muted-foreground">{formatValue(row.value, row.book)}</p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
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
    <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
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
            value={logsLoading ? "..." : logsError ? null : formatStatsReadingTime(stats.overview.readingMinutes)}
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

export function SeriesAnalyticsPaceChart({ stats }: { stats: SeriesStats }) {
  return (
    <StatsBarChart
      title="Speed by Book"
      rows={getSpeedChartRows(stats, "speed")}
      emptyLabel="Add reading time and page progress to compare reading speed."
    />
  );
}

export function SeriesAnalyticsFull({
  stats,
  logsLoading,
  logsError,
}: {
  stats: SeriesStats;
  logsLoading: boolean;
  logsError: string | null;
}) {
  const [paceMode, setPaceMode] = useState<SpeedChartMode>("speed");
  const [rankingMode, setRankingMode] = useState<RankingMode>("rating");
  const paceRows = useMemo(() => getSpeedChartRows(stats, paceMode), [paceMode, stats]);
  const ranking = useMemo(() => {
    if (rankingMode === "length") {
      return {
        rows: stats.rankings.length,
        emptyLabel: "No page totals yet",
        formatValue: (value: number) => `${value.toLocaleString()} pages`,
        getTieKey: (row: { book: Book; value: number }) => row.value,
      };
    }

    if (rankingMode === "annotations") {
      return {
        rows: stats.rankings.annotations,
        emptyLabel: "No annotations yet",
        formatValue: (value: number) => `${value} annotation${value === 1 ? "" : "s"}`,
        getTieKey: (row: { book: Book; value: number }) => row.value,
      };
    }

    return {
      rows: stats.rankings.rating,
      emptyLabel: "No ratings yet",
      formatValue: (value: number, book: Book) => (book.is_favorite ? "Favorite" : `${value.toFixed(1)} / 5`),
      getTieKey: (row: { book: Book; value: number }) => row.value,
    };
  }, [rankingMode, stats.rankings]);

  return (
    <div className="space-y-8">
      <SeriesAnalyticsOverview stats={stats} logsLoading={logsLoading} logsError={logsError} />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <AppHeading level={3} as="h2">Book Comparisons</AppHeading>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare how long each book took and how quickly pages moved.
            </p>
          </div>
          <SegmentedControl<SpeedChartMode>
            value={paceMode}
            onChange={setPaceMode}
            options={[
              { value: "speed", label: "Speed by Book" },
              { value: "duration", label: "Duration by Book" },
            ]}
          />
        </div>
        <StatsBarChart
          rows={paceRows}
          emptyLabel={
            paceMode === "duration"
              ? "No books with start dates yet."
              : "Add reading time and page progress to compare reading speed."
          }
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Podium className="h-4 w-4 text-primary" />
              <AppHeading level={3} as="h2">Book Rankings</AppHeading>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare standout volumes by rating, length, and annotations.
            </p>
          </div>
          <SegmentedControl<RankingMode>
            value={rankingMode}
            onChange={setRankingMode}
            options={[
              { value: "rating", label: "Top Rated" },
              { value: "length", label: "Longest" },
              { value: "annotations", label: "Most Annotated" },
            ]}
          />
        </div>
        <SeriesRankingPodium
          rows={ranking.rows}
          formatValue={ranking.formatValue}
          emptyLabel={ranking.emptyLabel}
          getTieKey={ranking.getTieKey}
        />
      </section>

      {logsError && (
        <p className="text-sm text-muted-foreground">
          Reading activity could not be loaded, so logged hours and date fallbacks may be unavailable.
        </p>
      )}
    </div>
  );
}
