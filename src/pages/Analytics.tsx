import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  Gauge,
  Layers3,
  Medal,
  RefreshCw,
  Timer,
  Trophy,
  Users,
} from "lucide-react";

import GenreDistributionChart from "@/components/GenreDistributionChart";
import ReadingHeatmap from "@/components/ReadingHeatmap";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import {
  buildAnalyticsDashboardData,
  type AnalyticsDashboardData,
  type TimeBucket,
} from "@/lib/analyticsDashboard";
import { fetchReadingLogs } from "@/lib/books";
import { getGenreChartColor, getSubgenreGenreChartColor, OTHERS_GENRE_CHART_COLOR } from "@/lib/genreChartColors";
import {
  calculateReadingHabits,
  formatMinutesCompact,
} from "@/lib/readingHabits";
import { cn } from "@/lib/utils";
import type { Book, ReadingLog, Series } from "@/types";

const DAY_PART_HOUR_RANGES: Record<string, string> = {
  Morning: "06:00-11:59",
  Afternoon: "12:00-17:59",
  Evening: "18:00-22:59",
  Night: "23:00-05:59",
};

type MonthlyTrendMetric = "books" | "pages" | "minutes";
type AnalyticsCategory = "author" | "genre" | "series" | "book";

const GENRE_EVOLUTION_SUBGENRE_PARENTS: Record<string, { parent: string; variant: number }> = {
  "high fantasy": { parent: "Fantasy", variant: 0 },
  "epic fantasy": { parent: "Fantasy", variant: 1 },
  "urban fantasy": { parent: "Fantasy", variant: 2 },
  "space opera": { parent: "Science Fiction", variant: 0 },
  dystopian: { parent: "Science Fiction", variant: 1 },
  "hard sci-fi": { parent: "Science Fiction", variant: 2 },
  "popular science": { parent: "Science & Technology", variant: 0 },
  "nature & environment": { parent: "Science & Technology", variant: 1 },
  "true crime": { parent: "Mystery & Crime", variant: 0 },
};

function getGenreEvolutionColor(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (normalized === "others") return OTHERS_GENRE_CHART_COLOR;

  const subgenre = GENRE_EVOLUTION_SUBGENRE_PARENTS[normalized];
  if (subgenre) {
    return getSubgenreGenreChartColor(getGenreChartColor(subgenre.parent), subgenre.variant);
  }

  return getGenreChartColor(label);
}

function getAnalyticsCategoryTitle(category: AnalyticsCategory): string {
  if (category === "author") return "Author Analytics";
  if (category === "genre") return "Genre Analytics";
  if (category === "series") return "Series Analytics";
  return "Book Analytics";
}

function getAnalyticsCategoryDescription(category: AnalyticsCategory): string {
  if (category === "author") return "Most-read authors, ratings, pages, and completion patterns.";
  if (category === "genre") return "Genre distribution, ratings, evolution, pages, time, and diversity.";
  if (category === "series") return "Series coverage and completion across your library.";
  return "Book completion, pages, reading time, pace, formats, and insights.";
}

function parseAnalyticsCategory(value?: string): AnalyticsCategory | null {
  if (value === "author" || value === "genre" || value === "series" || value === "book") return value;
  return null;
}

function getHabitsRangeIso(): { startIso: string; endIso: string } {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatReadingTime(totalMinutes: number | null): string {
  if (totalMinutes === null || totalMinutes <= 0) return "No data";
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatPace(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "No data";
  return `${value.toFixed(1)} pages/day`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "No data";
  return `${Math.round(value)}%`;
}

function formatDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "No data";
  const rounded = Math.round(value);
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}

function formatChartValue(value: number, unit: "books" | "pages" | "minutes" | "hours" | "pace" | "days"): string {
  if (unit === "books") return `${formatNumber(value)} book${Math.round(value) === 1 ? "" : "s"}`;
  if (unit === "days") return `${formatNumber(value)} day${Math.round(value) === 1 ? "" : "s"}`;
  if (unit === "pages") return `${formatNumber(value)} pages`;
  if (unit === "minutes") return formatReadingTime(value);
  if (unit === "hours") return `${value.toFixed(value >= 10 ? 0 : 1)}h`;
  return `${value.toFixed(1)} pages/day`;
}

function getBookSubtitle(book?: Book): string | null {
  if (!book) return null;
  return book.authors.length > 0 ? book.authors.join(", ") : null;
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-medium leading-tight">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  compact = false,
  onClick,
  active = false,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
  compact?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden="true" />
      </div>
      <p className={cn("font-semibold leading-tight", compact ? "mt-2 text-lg" : "mt-3 text-2xl")}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </>
  );

  const className = cn(
    "rounded-lg border border-border/60 bg-muted/10 transition-colors",
    compact ? "p-3" : "p-4",
    active ? "border-primary/70 bg-primary/5" : "",
    onClick ? "text-left hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" : ""
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-pressed={active}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function CategoryCard({
  title,
  description,
  icon: Icon,
  to,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-base font-heading leading-snug font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
    </Link>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-lg bg-muted/20 px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-heading leading-snug font-medium">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SimpleBarChart({
  title,
  data,
  unit,
  action,
  highlightKey,
  showAllXLabels = false,
}: {
  title: string;
  data: TimeBucket[];
  unit: "books" | "pages" | "minutes" | "pace" | "days";
  action?: React.ReactNode;
  highlightKey?: string | null;
  showAllXLabels?: boolean;
}) {
  const chartData = data;
  const maxValue = Math.max(...chartData.map((bucket) => bucket.value), 0);
  const yAxisMax = unit === "books" ? Math.ceil(maxValue) : maxValue;
  const yTicks = [yAxisMax, yAxisMax / 2, 0];
  const labelStep = useMemo(() => {
    if (showAllXLabels) return 1;
    if (chartData.length <= 6) return 1;
    if (chartData.length <= 12) return 2;
    if (chartData.length <= 24) return 3;
    if (chartData.length <= 36) return 4;
    return 6;
  }, [chartData.length, showAllXLabels]);
  const chartGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))`,
    }),
    [chartData.length]
  );

  return (
    <div className="rounded-lg bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-heading leading-snug font-medium">{title}</h3>
        {action}
      </div>
      {chartData.length === 0 || maxValue <= 0 ? (
        <EmptyPanel>No data for this chart yet.</EmptyPanel>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[3rem_1fr] gap-2">
            <div className="flex h-44 flex-col justify-between text-right text-[10px] text-muted-foreground">
              {yTicks.map((tick, index) => (
                <span key={`${tick}-${index}`}>
                  {unit === "minutes"
                    ? formatChartValue(tick, "minutes")
                    : unit === "pace"
                      ? tick.toFixed(1)
                      : formatNumber(Math.round(tick))}
                </span>
              ))}
            </div>
            <div className="min-w-0">
              <div className="relative h-44 w-full">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  <div className="border-t border-border/70" />
                  <div className="border-t border-border/50" />
                  <div className="border-t border-border/70" />
                </div>
                <div className="relative grid h-full w-full items-end gap-1" style={chartGridStyle}>
                  {chartData.map((bucket) => {
                    const height = bucket.value > 0 ? Math.max((bucket.value / yAxisMax) * 100, 4) : 0;
                    const highlighted = bucket.key === highlightKey;
                    return (
                      <button
                        key={bucket.key}
                        type="button"
                        className="group flex h-full min-w-0 items-end justify-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        aria-label={`${bucket.label}: ${formatChartValue(bucket.value, unit)}`}
                      >
                        <div
                          className={cn(
                            "w-[70%] max-w-8 rounded-t-sm transition-colors group-hover:bg-primary",
                            highlighted ? "bg-rating" : "bg-primary/85"
                          )}
                          style={{ height: `${height}%` }}
                          title={`${bucket.label}: ${formatChartValue(bucket.value, unit)}`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[3rem_1fr] gap-2">
            <div />
            <div className="grid w-full gap-1" style={chartGridStyle}>
              {chartData.map((bucket, index) => {
                const shouldShow =
                  chartData.length <= 6 ||
                  index === 0 ||
                  index === chartData.length - 1 ||
                  index % labelStep === 0;

                return (
                  <span key={`${bucket.key}-label`} className="min-w-0 break-words text-center text-[10px] leading-tight text-muted-foreground">
                    {shouldShow ? bucket.label : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LineChart({
  title,
  data,
  unit,
  empty,
}: {
  title: string;
  data: TimeBucket[];
  unit: "pages" | "pace";
  empty: string;
}) {
  const chartData = data;
  const maxValue = Math.max(...chartData.map((bucket) => bucket.value), 0);
  const yAxisMax = maxValue > 0 ? maxValue : 1;
  const yTicks = [yAxisMax, yAxisMax / 2, 0];
  const chartHeight = 176;
  const labelStep = useMemo(() => {
    if (chartData.length <= 6) return 1;
    if (chartData.length <= 12) return 2;
    if (chartData.length <= 24) return 3;
    if (chartData.length <= 36) return 4;
    return 6;
  }, [chartData.length]);
  const chartGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))`,
    }),
    [chartData.length]
  );
  const points = useMemo(() => {
    if (chartData.length === 0) return [];
    if (chartData.length === 1) {
      return [
        {
          ...chartData[0],
          x: 50,
          y: chartHeight - (chartData[0].value / yAxisMax) * chartHeight,
        },
      ];
    }

    return chartData.map((bucket, index) => ({
      ...bucket,
      x: (index / (chartData.length - 1)) * 100,
      y: chartHeight - (bucket.value / yAxisMax) * chartHeight,
    }));
  }, [chartData, yAxisMax]);
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints =
    points.length > 0
      ? `0,${chartHeight} ${points.map((point) => `${point.x},${point.y}`).join(" ")} 100,${chartHeight}`
      : "";

  return (
    <div className="rounded-lg bg-muted/20 p-4">
      <h3 className="text-base font-heading leading-snug font-medium">{title}</h3>
      {chartData.length === 0 || maxValue <= 0 ? (
        <EmptyPanel>{empty}</EmptyPanel>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[3rem_1fr] gap-2">
            <div className="flex h-44 flex-col justify-between text-right text-[10px] text-muted-foreground">
              {yTicks.map((tick, index) => (
                <span key={`${tick}-${index}`}>
                  {unit === "pace" ? tick.toFixed(1) : formatNumber(Math.round(tick))}
                </span>
              ))}
            </div>
            <div className="min-w-0">
              <div className="relative h-44 w-full">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  <div className="border-t border-border/70" />
                  <div className="border-t border-border/50" />
                  <div className="border-t border-border/70" />
                </div>

                <svg
                  className="absolute inset-0 overflow-visible"
                  width="100%"
                  height={chartHeight}
                  viewBox={`0 0 100 ${chartHeight}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Line chart showing average reading pace over time"
                >
                  <defs>
                    <linearGradient id="average-pace-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.34" />
                      <stop offset="70%" stopColor="var(--primary)" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={areaPoints} fill="url(#average-pace-fill)" />
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {points.map((point) => (
                  <button
                    key={point.key}
                    type="button"
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}px`,
                    }}
                    aria-label={`${point.label}: ${unit === "pace" ? formatChartValue(point.value, "pace") : formatChartValue(point.value, "pages")}`}
                    title={`${point.label}: ${unit === "pace" ? formatChartValue(point.value, "pace") : formatChartValue(point.value, "pages")}`}
                  >
                    <span className="block h-2.5 w-2.5 rounded-full border-2 border-background bg-primary shadow-sm" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[3rem_1fr] gap-2">
            <div />
            <div className="grid w-full gap-1" style={chartGridStyle}>
              {chartData.map((bucket, index) => {
                const shouldShow =
                  chartData.length <= 6 ||
                  index === 0 ||
                  index === chartData.length - 1 ||
                  index % labelStep === 0;

                return (
                  <span key={`${bucket.key}-label`} className="min-w-0 break-words text-center text-[10px] leading-tight text-muted-foreground">
                    {shouldShow ? bucket.label : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeekdayAverageChart({ weekdays }: { weekdays: ReturnType<typeof calculateReadingHabits>["weekdays"] }) {
  const maxMinutes = Math.max(...weekdays.all.map((day) => day.avgMinutesPerWeek), 0);

  if (!weekdays.highest || maxMinutes <= 0) {
    return <EmptyPanel>Add more timed reading sessions to see weekday averages.</EmptyPanel>;
  }

  return (
    <div className="rounded-lg bg-muted/20 p-4">
      <h3 className="text-base font-heading leading-snug font-medium">Average Reading Time by Weekday</h3>
      <div className="mt-4 grid grid-cols-[2.5rem_1fr] gap-2">
        <div className="flex h-36 flex-col justify-between text-right text-[10px] text-muted-foreground">
          <span>{formatReadingTime(maxMinutes)}</span>
          <span>{formatReadingTime(maxMinutes / 2)}</span>
          <span>0m</span>
        </div>
        <div className="min-w-0">
          <div className="relative h-36">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-border/70" />
              <div className="border-t border-border/50" />
              <div className="border-t border-border/70" />
            </div>
            <div className="relative grid h-full grid-cols-7 items-end gap-2">
              {weekdays.all.map((day) => {
                const height = day.avgMinutesPerWeek > 0 ? Math.max((day.avgMinutesPerWeek / maxMinutes) * 100, 4) : 0;
                return (
                  <button
                    key={day.weekdayLabel}
                    type="button"
                    className="group flex h-full min-w-0 items-end justify-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label={`${day.weekdayLabel}: ${formatReadingTime(day.avgMinutesPerWeek)} average reading time per week`}
                    title={`${day.weekdayLabel}: ${formatReadingTime(day.avgMinutesPerWeek)}`}
                  >
                    <div
                      className="w-[70%] max-w-8 rounded-t-sm bg-primary/85 transition-colors group-hover:bg-primary"
                      style={{ height: `${height}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {weekdays.all.map((day) => (
              <span key={day.weekdayLabel} className="text-center text-[10px] text-muted-foreground">
                {day.weekdayLabel.slice(0, 3)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsualReadingTime({ data }: { data: ReturnType<typeof calculateReadingHabits>["usualTime"] }) {
  const hasTrackedMinutes = data.dayParts.some((part) => part.minutes > 0);
  function getDayPartColor(label: (typeof data.dayParts)[number]["label"]): string {
    if (label === "Morning") return "var(--rating)";
    if (label === "Afternoon") return "var(--primary)";
    if (label === "Evening") return "var(--quote)";
    return "var(--favorite)";
  }

  return (
    <div className="rounded-lg bg-muted/20 p-4">
      <h3 className="text-base font-heading leading-snug font-medium">Usual Reading Time</h3>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.dayParts.map((part) => {
          const color = getDayPartColor(part.label);
          return (
            <div
              key={part.label}
              className="rounded-md border-2 bg-background/80 px-3 py-2"
              style={{ borderColor: color }}
            >
              <p className="text-xs text-muted-foreground">{part.label}</p>
              <p className="text-lg font-semibold">{part.percentage.toFixed(0)}%</p>
              <p className="text-[11px] text-muted-foreground">
                {DAY_PART_HOUR_RANGES[part.label]} · {formatMinutesCompact(part.minutes)}
              </p>
            </div>
          );
        })}
      </div>
      {!hasTrackedMinutes ? (
        <p className="mt-3 text-sm text-muted-foreground">No tracked reading time yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex h-5 overflow-hidden rounded-full bg-muted">
            {data.dayParts.map((part) => (
              <div
                key={part.label}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${part.percentage}%`,
                  backgroundColor: getDayPartColor(part.label),
                }}
                title={`${part.label}: ${part.percentage.toFixed(0)}%`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Most common hour: {data.dominantHourLabel ?? "No dominant reading hour yet"}
          </p>
        </div>
      )}
    </div>
  );
}

function SessionDensity({
  sprint,
  marathon,
}: {
  sprint: number | null;
  marathon: number | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Session Density</p>
      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span>Sprint Sessions (&lt;20 min)</span>
            <span className="font-semibold">{formatPercent(sprint)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${sprint ?? 0}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span>Marathon Sessions (&gt;60 min)</span>
            <span className="font-semibold">{formatPercent(marathon)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-rating" style={{ width: `${marathon ?? 0}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GenreEvolutionChart({ data }: { data: AnalyticsDashboardData["preferences"]["genreEvolution"] }) {
  if (data.length === 0) {
    return <EmptyPanel>Finish books with genres to see genre evolution.</EmptyPanel>;
  }

  return (
    <div className="space-y-4">
      {data.map((year) => (
        <div key={year.year} className="grid gap-2 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center">
          <p className="text-sm font-medium">{year.year}</p>
          <div>
            <div className="flex h-5 overflow-hidden rounded-sm bg-muted">
              {year.genres.map((genre) => (
                <div
                  key={genre.label}
                  className="h-full"
                  style={{
                    width: `${genre.percentage}%`,
                    backgroundColor: getGenreEvolutionColor(genre.label),
                  }}
                  title={`${genre.label}: ${formatPercent(genre.percentage)}`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {year.genres.map((genre) => (
                <span key={genre.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: getGenreEvolutionColor(genre.label) }}
                    aria-hidden="true"
                  />
                  {genre.label} {formatPercent(genre.percentage)}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuthorLoyalty({ data }: { data: AnalyticsDashboardData["preferences"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg bg-muted/20 p-4">
        <h3 className="text-base font-heading leading-snug font-medium">Most-read Authors</h3>
        <RankedList
          items={data.mostReadAuthors.map((author) => ({
            label: author.label,
            value: `${author.value} book${author.value === 1 ? "" : "s"}`,
          }))}
          empty="Finish books with authors to see this list."
        />
      </div>
      <div className="rounded-lg bg-muted/20 p-4">
        <h3 className="text-base font-heading leading-snug font-medium">Highest-rated Authors</h3>
        <RankedList
          items={data.highestRatedAuthors.map((author) => ({
            label: author.label,
            value: `${author.value.toFixed(1)} / 5 (${author.bookCount})`,
          }))}
          empty="Rate finished books to see this list."
        />
      </div>
    </div>
  );
}

function RankedList({ items, empty }: { items: Array<{ label: string; value: string }>; empty: string }) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ol className="mt-3 space-y-2">
      {items.map((item, index) => (
        <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate">
            <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>
            {item.label}
          </span>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{item.value}</span>
        </li>
      ))}
    </ol>
  );
}

function FormatDistributionChart({ data }: { data: AnalyticsDashboardData["preferences"]["formatDistribution"] }) {
  if (data.total === 0) {
    return <EmptyPanel>Add book formats to see format distribution.</EmptyPanel>;
  }

  const physicalPercent = (data.physical.total / data.total) * 100;
  const ebookPercent = (data.ebook / data.total) * 100;
  const audiobookPercent = (data.audiobook / data.total) * 100;
  const hardcoverPercent = data.physical.total > 0 ? (data.physical.hardcover / data.physical.total) * 100 : 0;
  const paperbackPercent = data.physical.total > 0 ? (data.physical.paperback / data.physical.total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex h-8 overflow-hidden rounded-sm bg-muted">
        <div className="flex h-full" style={{ width: `${physicalPercent}%` }} title={`Physical: ${formatPercent(physicalPercent)}`}>
          <div className="h-full bg-primary" style={{ width: `${hardcoverPercent}%` }} title={`Hardcover: ${data.physical.hardcover}`} />
          <div className="h-full bg-primary/60" style={{ width: `${paperbackPercent}%` }} title={`Paperback: ${data.physical.paperback}`} />
        </div>
        <div className="h-full bg-quote" style={{ width: `${ebookPercent}%` }} title={`eBook: ${formatPercent(ebookPercent)}`} />
        <div className="h-full bg-rating" style={{ width: `${audiobookPercent}%` }} title={`Audiobook: ${formatPercent(audiobookPercent)}`} />
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <FormatLegend color="bg-primary" label="Hardcover" value={data.physical.hardcover} />
        <FormatLegend color="bg-primary/60" label="Paperback" value={data.physical.paperback} />
        <FormatLegend color="bg-quote" label="eBook" value={data.ebook} />
        <FormatLegend color="bg-rating" label="Audiobook" value={data.audiobook} />
      </div>
    </div>
  );
}

function FormatLegend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <span className={cn("h-2.5 w-2.5 rounded-sm", color)} aria-hidden="true" />
      <span className="text-foreground">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function bestBucket(data: TimeBucket[]): TimeBucket | null {
  return [...data].sort((left, right) => {
    if (right.value !== left.value) return right.value - left.value;
    return left.key.localeCompare(right.key);
  })[0] ?? null;
}

function worstPositiveBucket(data: TimeBucket[]): TimeBucket | null {
  return [...data]
    .filter((bucket) => bucket.value > 0)
    .sort((left, right) => {
      if (left.value !== right.value) return left.value - right.value;
      return left.key.localeCompare(right.key);
    })[0] ?? null;
}

function booksByYear(data: AnalyticsDashboardData["trends"]["yearComparison"]): TimeBucket[] {
  return data.map((bucket) => ({
    key: bucket.year,
    label: bucket.year,
    value: bucket.books,
  }));
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatRating(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "No data";
  return `${value.toFixed(1)} / 5`;
}

function formatPages(value: number): string {
  return `${formatNumber(value)} pages`;
}

function getAnalyticsBookGenres(book: Book): string[] {
  const rawGenres = book.genres ?? book.genre_paths ?? [];
  return Array.from(new Set(rawGenres.map((genre) => genre.trim()).filter(Boolean)));
}

function buildReadingMinutesByBook(logs: ReadingLog[]): Map<string, number> {
  const minutesByBook = new Map<string, number>();

  for (const log of logs) {
    minutesByBook.set(log.book_id, (minutesByBook.get(log.book_id) ?? 0) + Math.max(0, log.reading_time_minutes ?? 0));
  }

  return minutesByBook;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildBookCategoryAnalytics(books: Book[], logs: ReadingLog[]) {
  const finishedBooks = books.filter((book) => book.status === "Finished");
  const minutesByBook = buildReadingMinutesByBook(logs);
  const ratedBooks = finishedBooks.filter((book) => typeof book.rating === "number");
  const booksWithPages = finishedBooks.filter((book) => (book.total_pages ?? 0) > 0);

  return {
    longestBooks: [...booksWithPages]
      .sort((left, right) => (right.total_pages ?? 0) - (left.total_pages ?? 0))
      .slice(0, 8),
    highestRatedBooks: [...ratedBooks]
      .sort((left, right) => {
        if ((right.rating ?? 0) !== (left.rating ?? 0)) return (right.rating ?? 0) - (left.rating ?? 0);
        return left.title.localeCompare(right.title);
      })
      .slice(0, 8),
    averagePagesPerBook: average(booksWithPages.map((book) => book.total_pages ?? 0)),
    readingTimeByBook: books
      .map((book) => ({
        book,
        minutes: minutesByBook.get(book.id) ?? 0,
      }))
      .filter((entry) => entry.minutes > 0)
      .sort((left, right) => right.minutes - left.minutes)
      .slice(0, 8),
  };
}

function buildAuthorCategoryAnalytics(books: Book[]) {
  const authors = new Map<string, { books: number; completed: number; pages: number; ratingTotal: number; ratingCount: number }>();

  for (const book of books) {
    const bookAuthors = Array.from(new Set(book.authors.map((author) => author.trim()).filter(Boolean)));
    for (const author of bookAuthors) {
      const current = authors.get(author) ?? { books: 0, completed: 0, pages: 0, ratingTotal: 0, ratingCount: 0 };
      current.books += 1;
      if (book.status === "Finished") {
        current.completed += 1;
        current.pages += Math.max(0, book.total_pages ?? 0);
      }
      if (typeof book.rating === "number") {
        current.ratingTotal += book.rating;
        current.ratingCount += 1;
      }
      authors.set(author, current);
    }
  }

  const rows = [...authors.entries()]
    .map(([author, stats]) => ({
      author,
      books: stats.books,
      completed: stats.completed,
      pages: stats.pages,
      averageRating: stats.ratingCount > 0 ? stats.ratingTotal / stats.ratingCount : null,
    }))
    .sort((left, right) => {
      if (right.completed !== left.completed) return right.completed - left.completed;
      if (right.books !== left.books) return right.books - left.books;
      return left.author.localeCompare(right.author);
    });

  return {
    rows,
    pagesRead: [...rows].sort((left, right) => right.pages - left.pages).slice(0, 8),
    completedBooks: [...rows].sort((left, right) => right.completed - left.completed).slice(0, 8),
    favoriteRanking: [...rows]
      .filter((row) => row.averageRating !== null)
      .sort((left, right) => {
        if ((right.averageRating ?? 0) !== (left.averageRating ?? 0)) return (right.averageRating ?? 0) - (left.averageRating ?? 0);
        if (right.completed !== left.completed) return right.completed - left.completed;
        return right.pages - left.pages;
      })
      .slice(0, 6),
  };
}

function buildGenreCategoryAnalytics(books: Book[], logs: ReadingLog[]) {
  const genreStats = new Map<string, { books: number; pages: number; ratingTotal: number; ratingCount: number; minutes: number }>();
  const minutesByBook = buildReadingMinutesByBook(logs);
  const currentYear = new Date().getFullYear();
  const genresThisYear = new Set<string>();

  for (const book of books) {
    const genres = getAnalyticsBookGenres(book);
    if (genres.length === 0) continue;

    const bookMinutes = minutesByBook.get(book.id) ?? 0;
    const finishedThisYear =
      book.status === "Finished" && book.date_finished
        ? new Date(book.date_finished).getFullYear() === currentYear
        : false;

    for (const genre of genres) {
      const current = genreStats.get(genre) ?? { books: 0, pages: 0, ratingTotal: 0, ratingCount: 0, minutes: 0 };
      if (book.status === "Finished") {
        current.books += 1;
        current.pages += Math.max(0, book.total_pages ?? 0);
      }
      if (typeof book.rating === "number") {
        current.ratingTotal += book.rating;
        current.ratingCount += 1;
      }
      current.minutes += bookMinutes;
      genreStats.set(genre, current);
      if (finishedThisYear) genresThisYear.add(genre);
    }
  }

  const rows = [...genreStats.entries()].map(([genre, stats]) => ({
    genre,
    books: stats.books,
    pages: stats.pages,
    minutes: stats.minutes,
    averageRating: stats.ratingCount > 0 ? stats.ratingTotal / stats.ratingCount : null,
  }));

  return {
    totalGenres: rows.filter((row) => row.books > 0).length,
    genresThisYear: genresThisYear.size,
    pagesRead: [...rows].sort((left, right) => right.pages - left.pages).slice(0, 8),
    readingTime: [...rows].sort((left, right) => right.minutes - left.minutes).slice(0, 8),
  };
}

function MetricList({
  title,
  items,
  formatValue,
  empty,
}: {
  title: string;
  items: Array<{ label: string; value: number; bookCount: number }>;
  formatValue: (item: { label: string; value: number; bookCount: number }) => string;
  empty: string;
}) {
  return (
    <div className="rounded-lg bg-muted/20 p-4">
      <h3 className="text-base font-heading leading-snug font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {items.slice(0, 8).map((item, index) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>
                {item.label}
              </span>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatValue(item)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function buildSeriesAnalytics(books: Book[], series: Series[]) {
  const seriesById = new Map(series.map((entry) => [entry.id, entry]));
  const booksBySeries = new Map<string, Book[]>();

  for (const book of books) {
    if (!book.series_id) continue;
    const list = booksBySeries.get(book.series_id) ?? [];
    list.push(book);
    booksBySeries.set(book.series_id, list);
  }

  const seriesStats = [...booksBySeries.entries()]
    .map(([seriesId, seriesBooks]) => {
      const knownSeries = seriesById.get(seriesId);
      const finishedBooks = seriesBooks.filter((book) => book.status === "Finished").length;
      const pagesRead = seriesBooks
        .filter((book) => book.status === "Finished")
        .reduce((sum, book) => sum + Math.max(0, book.total_pages ?? 0), 0);
      const ratings = seriesBooks
        .map((book) => book.rating)
        .filter((rating): rating is number => typeof rating === "number");
      const averageRating = average(ratings);

      return {
        id: seriesId,
        name: knownSeries?.name ?? "Unknown series",
        totalBooks: seriesBooks.length,
        finishedBooks,
        completed: seriesBooks.length > 0 && finishedBooks === seriesBooks.length,
        ongoing: seriesBooks.some((book) => book.status === "Reading" || book.status === "Paused" || book.status === "Up Next" || book.status === "Not Started"),
        pagesRead,
        averageRating,
      };
    })
    .sort((left, right) => {
      if (right.totalBooks !== left.totalBooks) return right.totalBooks - left.totalBooks;
      return left.name.localeCompare(right.name);
    });

  return {
    totalSeries: series.length,
    seriesWithBooks: seriesStats.length,
    booksInSeries: seriesStats.reduce((sum, entry) => sum + entry.totalBooks, 0),
    completedSeries: seriesStats.filter((entry) => entry.completed).length,
    ongoingSeries: seriesStats.filter((entry) => !entry.completed).length,
    largestSeries: seriesStats[0] ?? null,
    favoriteSeries: [...seriesStats]
      .filter((entry) => entry.averageRating !== null)
      .sort((left, right) => {
        if ((right.averageRating ?? 0) !== (left.averageRating ?? 0)) return (right.averageRating ?? 0) - (left.averageRating ?? 0);
        return right.pagesRead - left.pagesRead;
      })[0] ?? null,
    pagesReadBySeries: [...seriesStats].sort((left, right) => right.pagesRead - left.pagesRead).slice(0, 8),
    averageRatingBySeries: [...seriesStats]
      .filter((entry) => entry.averageRating !== null)
      .sort((left, right) => (right.averageRating ?? 0) - (left.averageRating ?? 0))
      .slice(0, 8),
    seriesStats,
  };
}

function SeriesAnalyticsPanel({
  books,
  series,
  loading,
  error,
}: {
  books: Book[];
  series: Series[];
  loading: boolean;
  error: string | null;
}) {
  const data = useMemo(() => buildSeriesAnalytics(books, series), [books, series]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
        <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DetailSection title="Series Summary">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailStat label="Series" value={formatNumber(data.totalSeries)} />
          <DetailStat label="Series with books" value={formatNumber(data.seriesWithBooks)} />
          <DetailStat label="Books in series" value={formatNumber(data.booksInSeries)} />
          <DetailStat label="Completed series" value={formatNumber(data.completedSeries)} />
          <DetailStat label="Ongoing series" value={formatNumber(data.ongoingSeries)} />
          <DetailStat
            label="Favorite series"
            value={data.favoriteSeries ? `${data.favoriteSeries.name} · ${formatRating(data.favoriteSeries.averageRating)}` : "No data"}
          />
        </div>
      </DetailSection>
      <div className="grid gap-4 xl:grid-cols-2">
        <DetailSection title="Largest Series">
          <div className="rounded-lg bg-muted/20 p-4">
          {data.largestSeries ? (
            <div className="text-sm">
              <p className="font-medium">{data.largestSeries.name}</p>
              <p className="text-muted-foreground">
                {data.largestSeries.totalBooks} book{data.largestSeries.totalBooks === 1 ? "" : "s"} in your library
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Add series to books to see series analytics.</p>
          )}
          </div>
        </DetailSection>
        <DetailSection title="Series Progress">
          <div className="rounded-lg bg-muted/20 p-4">
          {data.seriesStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No series with books yet.</p>
          ) : (
            <ol className="space-y-2">
              {data.seriesStats.slice(0, 8).map((entry) => (
                <li key={entry.id} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{entry.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {entry.finishedBooks}/{entry.totalBooks} finished
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${entry.totalBooks > 0 ? (entry.finishedBooks / entry.totalBooks) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
          </div>
        </DetailSection>
      </div>
      <DetailSection title="Completed vs Ongoing Series">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailStat label="Completed" value={formatNumber(data.completedSeries)} />
          <DetailStat label="Ongoing" value={formatNumber(data.ongoingSeries)} />
        </div>
      </DetailSection>
      <DetailSection title="Pages Read By Series">
        <div className="rounded-lg bg-muted/20 p-4">
          <RankedList
            items={data.pagesReadBySeries.map((entry) => ({
              label: entry.name,
              value: formatPages(entry.pagesRead),
            }))}
            empty="Finish books in series to see pages read by series."
          />
        </div>
      </DetailSection>
      <DetailSection title="Average Rating Per Series">
        <div className="rounded-lg bg-muted/20 p-4">
          <RankedList
            items={data.averageRatingBySeries.map((entry) => ({
              label: entry.name,
              value: formatRating(entry.averageRating),
            }))}
            empty="Rate books in series to see average ratings."
          />
        </div>
      </DetailSection>
    </div>
  );
}

function AuthorRankingCards({
  authors,
}: {
  authors: ReturnType<typeof buildAuthorCategoryAnalytics>["favoriteRanking"];
}) {
  if (authors.length === 0) {
    return <EmptyPanel>Rate books with authors to see favorite author rankings.</EmptyPanel>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {authors.map((author) => (
        <div key={author.author} className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-base font-heading leading-snug font-medium">{author.author}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {author.completed} book{author.completed === 1 ? "" : "s"} • {formatRating(author.averageRating)} average rating •{" "}
            {formatPages(author.pages)}
          </p>
        </div>
      ))}
    </div>
  );
}

function AnalyticsCategoryPanel({
  activeCategory,
  analytics,
  habits,
  books,
  logs,
  genres,
  genresError,
  booksLoading,
  series,
  seriesLoading,
  seriesError,
}: {
  activeCategory: AnalyticsCategory;
  analytics: AnalyticsDashboardData;
  habits: ReturnType<typeof calculateReadingHabits>;
  books: Book[];
  logs: ReadingLog[];
  genres: ReturnType<typeof useGenresContext>["genres"];
  genresError: string | null;
  booksLoading: boolean;
  series: Series[];
  seriesLoading: boolean;
  seriesError: string | null;
}) {
  const monthBest = bestBucket(analytics.trends.booksFinishedByMonth);
  const yearData = booksByYear(analytics.trends.yearComparison);
  const yearBest = bestBucket(yearData);
  const largestReadingMonth = bestBucket(analytics.trends.pagesReadByMonth);
  const fastestMonth = bestBucket(analytics.trends.averagePaceByMonth);
  const slowestMonth = worstPositiveBucket(analytics.trends.averagePaceByMonth);
  const paceValues = analytics.trends.averagePaceByMonth.filter((bucket) => bucket.value > 0).map((bucket) => bucket.value);
  const paceRange = paceValues.length > 0 ? Math.max(...paceValues) - Math.min(...paceValues) : null;
  const bookCategory = useMemo(() => buildBookCategoryAnalytics(books, logs), [books, logs]);
  const authorCategory = useMemo(() => buildAuthorCategoryAnalytics(books), [books]);
  const genreCategory = useMemo(() => buildGenreCategoryAnalytics(books, logs), [books, logs]);

  return (
    <div className="space-y-4">
      {activeCategory === "author" ? (
        <>
          <DetailSection title="Author Summary">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailStat label="Favorite Author" value={analytics.insights.favoriteAuthor ?? "No data"} />
              <DetailStat label="Most Reread Author" value={analytics.insights.mostRereadAuthor ?? "No data"} />
              <DetailStat label="Authors tracked" value={formatNumber(authorCategory.rows.length)} />
              <DetailStat
                label="Top author pages"
                value={authorCategory.pagesRead[0] ? `${authorCategory.pagesRead[0].author} · ${formatPages(authorCategory.pagesRead[0].pages)}` : "No data"}
              />
            </div>
          </DetailSection>
          <DetailSection title="Favorite Author Ranking">
            <AuthorRankingCards authors={authorCategory.favoriteRanking} />
          </DetailSection>
          <DetailSection title="Author Loyalty">
            <AuthorLoyalty data={analytics.preferences} />
          </DetailSection>
          <DetailSection title="Pages Read Per Author">
            <div className="rounded-lg bg-muted/20 p-4">
              <RankedList
                items={authorCategory.pagesRead.map((author) => ({
                  label: author.author,
                  value: formatPages(author.pages),
                }))}
                empty="Finish books with page counts to see pages by author."
              />
            </div>
          </DetailSection>
          <DetailSection title="Books Completed Per Author">
            <div className="rounded-lg bg-muted/20 p-4">
              <RankedList
                items={authorCategory.completedBooks.map((author) => ({
                  label: author.author,
                  value: `${author.completed} completed`,
                }))}
                empty="Finish books with authors to see completed books by author."
              />
            </div>
          </DetailSection>
        </>
      ) : null}

      {activeCategory === "genre" ? (
        <>
          <DetailSection title="Genre Distribution">
            <div className="rounded-lg bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link to="/genres" className="text-sm font-medium text-primary hover:underline">
                  Browse Genres -&gt;
                </Link>
              </div>
              <div className="mt-4">
                <GenreDistributionChart
                  books={books}
                  genres={genres}
                  loading={booksLoading}
                  error={genresError}
                />
              </div>
            </div>
          </DetailSection>
          <DetailSection title="Genre Insights">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailStat label="Favorite Genre" value={analytics.insights.favoriteGenre ?? "No data"} />
              <DetailStat label="Genre Explored Most This Year" value={analytics.insights.genreExploredMostThisYear ?? "No data"} />
              <DetailStat label="Genre Diversity" value={`${formatNumber(genreCategory.totalGenres)} genres`} />
              <DetailStat label="Genres This Year" value={formatNumber(genreCategory.genresThisYear)} />
            </div>
          </DetailSection>
          <DetailSection title="Genre Ratings">
            <MetricList
              title="Genre Ratings"
              items={analytics.preferences.genreRatings}
              formatValue={(item) => `${item.value.toFixed(1)} / 5 (${item.bookCount})`}
              empty="Rate finished books to see genre ratings."
            />
          </DetailSection>
          <DetailSection title="Genre Evolution">
            <div className="rounded-lg bg-muted/20 p-4">
              <GenreEvolutionChart data={analytics.preferences.genreEvolution} />
            </div>
          </DetailSection>
          <DetailSection title="Pages Read By Genre">
            <div className="rounded-lg bg-muted/20 p-4">
              <RankedList
                items={genreCategory.pagesRead.map((genre) => ({
                  label: genre.genre,
                  value: formatPages(genre.pages),
                }))}
                empty="Finish books with genres and page counts to see pages by genre."
              />
            </div>
          </DetailSection>
          <DetailSection title="Reading Time By Genre">
            <div className="rounded-lg bg-muted/20 p-4">
              <RankedList
                items={genreCategory.readingTime.map((genre) => ({
                  label: genre.genre,
                  value: formatReadingTime(genre.minutes),
                }))}
                empty="Log reading time for books with genres to see reading time by genre."
              />
            </div>
          </DetailSection>
          <DetailSection title="Most Abandoned Genres">
            <div className="rounded-lg bg-muted/20 p-4">
              {analytics.completion.hasEnoughDnfData ? (
                <RankedList
                  items={analytics.completion.abandonedGenres.map((genre) => ({
                    label: genre.label,
                    value: `${genre.value} DNF`,
                  }))}
                  empty="DNF books do not have genre data yet."
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  This appears after at least 3 DNF books, so one abandoned book does not create a misleading pattern.
                </p>
              )}
            </div>
          </DetailSection>
        </>
      ) : null}

      {activeCategory === "series" ? (
        <SeriesAnalyticsPanel books={books} series={series} loading={seriesLoading} error={seriesError} />
      ) : null}

      {activeCategory === "book" ? (
        <>
          <DetailSection title="Finished Books">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailStat label="Best month" value={monthBest ? `${monthBest.label} · ${formatNumber(monthBest.value)} books` : "No data"} />
              <DetailStat label="Best year" value={yearBest ? `${yearBest.label} · ${formatNumber(yearBest.value)} books` : "No data"} />
              <DetailStat
                label="Average pages per book"
                value={bookCategory.averagePagesPerBook === null ? "No data" : formatPages(Math.round(bookCategory.averagePagesPerBook))}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <SimpleBarChart title="Books Per Month" data={analytics.trends.booksFinishedByMonth} unit="books" highlightKey={monthBest?.key} />
              <SimpleBarChart title="Books Per Year" data={yearData} unit="books" highlightKey={yearBest?.key} />
            </div>
          </DetailSection>
          <DetailSection title="Longest Books Read">
            <div className="rounded-lg bg-muted/20 p-4">
              <RankedList
                items={bookCategory.longestBooks.map((book) => ({
                  label: book.title,
                  value: formatPages(book.total_pages ?? 0),
                }))}
                empty="Finish books with page counts to see the longest books."
              />
            </div>
          </DetailSection>
          <DetailSection title="Highest-rated Books">
            <div className="rounded-lg bg-muted/20 p-4">
              <RankedList
                items={bookCategory.highestRatedBooks.map((book) => ({
                  label: book.title,
                  value: formatRating(book.rating ?? null),
                }))}
                empty="Rate finished books to see highest-rated books."
              />
            </div>
          </DetailSection>
          <DetailSection title="Pages">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailStat label="Largest reading month" value={largestReadingMonth ? `${largestReadingMonth.label} · ${formatNumber(largestReadingMonth.value)} pages` : "No data"} />
              <DetailStat
                label="Average book length"
                value={
                  analytics.insights.averageBookLength === null
                    ? "No data"
                    : `${formatNumber(Math.round(analytics.insights.averageBookLength))} pages`
                }
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <SimpleBarChart title="Pages Per Month" data={analytics.trends.pagesReadByMonth} unit="pages" highlightKey={largestReadingMonth?.key} />
              <LineChart title="Cumulative Pages" data={analytics.trends.cumulativePagesByMonth} unit="pages" empty="No page data yet." />
            </div>
          </DetailSection>
          <DetailSection title="Reading Time">
            <SimpleBarChart title="Reading Time Per Month" data={analytics.trends.readingMinutesByMonth} unit="minutes" />
            <div className="rounded-lg bg-muted/20 p-4">
              <h3 className="text-base font-heading leading-snug font-medium">Reading Time By Book</h3>
              <RankedList
                items={bookCategory.readingTimeByBook.map((entry) => ({
                  label: entry.book.title,
                  value: formatReadingTime(entry.minutes),
                }))}
                empty="Log reading time to see reading time by book."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Average Session Length" value={formatReadingTime(analytics.habits.averageSessionMinutes)} icon={Timer} />
              <SessionDensity sprint={analytics.habits.sprintSessionPercentage} marathon={analytics.habits.marathonSessionPercentage} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <WeekdayAverageChart weekdays={habits.weekdays} />
              <UsualReadingTime data={habits.usualTime} />
            </div>
          </DetailSection>
          <DetailSection title="Pace">
            <div className="grid gap-3 sm:grid-cols-3">
              <DetailStat label="Fastest month" value={fastestMonth ? `${fastestMonth.label} · ${formatPace(fastestMonth.value)}` : "No data"} />
              <DetailStat label="Slowest month" value={slowestMonth ? `${slowestMonth.label} · ${formatPace(slowestMonth.value)}` : "No data"} />
              <DetailStat label="Pace consistency" value={paceRange === null ? "No data" : `${paceRange.toFixed(1)} page/day range`} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <LineChart title="Pace Trend" data={analytics.trends.averagePaceByMonth} unit="pace" empty="No pace data yet." />
              <SimpleBarChart
                title="Reading days by pages read"
                data={analytics.trends.pagesPerDayDistribution}
                unit="days"
                showAllXLabels
              />
            </div>
          </DetailSection>
          <DetailSection title="Completion">
            <CompletionRate data={analytics.completion} />
          </DetailSection>
          <DetailSection title="Formats">
            <div className="rounded-lg bg-muted/20 p-4">
              <FormatDistributionChart data={analytics.preferences.formatDistribution} />
            </div>
          </DetailSection>
          <DetailSection title="Insights">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Average Reading Gap"
                value={analytics.insights.averageReadingGapDays === null ? "No data" : formatDays(analytics.insights.averageReadingGapDays)}
                icon={CalendarDays}
                compact
              />
              <StatCard
                label="Most Productive Month"
                value={analytics.insights.mostProductiveMonth ?? "No data"}
                icon={BarChart3}
                compact
              />
              <StatCard
                label="Average Book Length"
                value={
                  analytics.insights.averageBookLength === null
                    ? "No data"
                    : `${formatNumber(Math.round(analytics.insights.averageBookLength))} pages`
                }
                icon={BookOpen}
                compact
              />
              <StatCard
                label="Day of Week You Read Most"
                value={analytics.insights.mostReadWeekday ?? "No data"}
                icon={CalendarDays}
                compact
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <HallOfFameCard label="Longest Reading Session" record={analytics.hallOfFame.longestSession} icon={Trophy} />
              <HallOfFameCard label="Most Pages In One Day" record={analytics.hallOfFame.mostPagesOneDay} icon={Award} />
              <HallOfFameCard label="Fastest Finished Book" record={analytics.hallOfFame.fastestFinishedBook} icon={Medal} />
              <HallOfFameCard label="Longest Finished Book" record={analytics.hallOfFame.longestFinishedBook} icon={BookOpen} />
              <HallOfFameCard label="Longest Completion Time" record={analytics.hallOfFame.longestCompletionTime} icon={Clock} />
              <HallOfFameCard label="Most Books Finished In A Month" record={analytics.hallOfFame.mostBooksFinishedInMonth} icon={BarChart3} />
            </div>
          </DetailSection>
        </>
      ) : null}
    </div>
  );
}

function CompletionRate({ data }: { data: AnalyticsDashboardData["completion"] }) {
  if (data.completedPercentage === null || data.dnfPercentage === null) {
    return <EmptyPanel>Finish or DNF books to see completion analytics.</EmptyPanel>;
  }

  return (
    <div className="rounded-lg bg-muted/20 p-4">
      <h3 className="text-base font-heading leading-snug font-medium">Completion Rate</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="mt-1 text-3xl font-semibold">{formatPercent(data.completedPercentage)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
          <p className="text-xs text-muted-foreground">DNF</p>
          <p className="mt-1 text-3xl font-semibold">{formatPercent(data.dnfPercentage)}</p>
        </div>
      </div>
    </div>
  );
}

function HallOfFameCard({
  record,
  label,
  icon: Icon,
}: {
  record: AnalyticsDashboardData["hallOfFame"][keyof AnalyticsDashboardData["hallOfFame"]];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-card)]">
      <div className="flex gap-3 p-4">
        <div className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {record?.book?.cover_url ? (
            <img src={record.book.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {record?.label ?? label}
          </p>
          <p className="mt-1 text-lg font-semibold leading-tight">{record?.value ?? "No data"}</p>
          {record?.book ? (
            <div className="mt-1 min-w-0 text-xs text-muted-foreground">
              <p className="truncate text-foreground">{record.book.title}</p>
              {getBookSubtitle(record.book) ? <p className="truncate">{getBookSubtitle(record.book)}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { category } = useParams();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { genres, error: genresError } = useGenresContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [monthlyTrendMetric, setMonthlyTrendMetric] = useState<MonthlyTrendMetric>("books");

  const habitsRange = useMemo(() => getHabitsRangeIso(), []);
  const habitsStartMs = useMemo(() => new Date(habitsRange.startIso).getTime(), [habitsRange.startIso]);
  const habitsEndMs = useMemo(() => new Date(habitsRange.endIso).getTime(), [habitsRange.endIso]);
  const habitsLogs = useMemo(
    () =>
      logs.filter((log) => {
        const loggedAt = new Date(log.logged_at).getTime();
        return loggedAt >= habitsStartMs && loggedAt <= habitsEndMs;
      }),
    [habitsEndMs, habitsStartMs, logs]
  );
  const habits = useMemo(
    () => calculateReadingHabits(habitsLogs, habitsRange.startIso, habitsRange.endIso),
    [habitsLogs, habitsRange.endIso, habitsRange.startIso]
  );
  const analytics = useMemo(() => buildAnalyticsDashboardData(books, logs), [books, logs]);

  async function loadReadingLogs() {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const data = await fetchReadingLogs();
      setLogs(data);
    } catch (err) {
      setLogsError(err instanceof Error ? err.message : "Failed to load reading activity");
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    loadReadingLogs();
  }, []);

  const isLoading = booksLoading || logsLoading;
  const monthlyTrendChart = useMemo(() => {
    if (monthlyTrendMetric === "pages") {
      return {
        title: "Pages read per month",
        data: analytics.trends.pagesReadByMonth,
        unit: "pages" as const,
      };
    }

    if (monthlyTrendMetric === "minutes") {
      return {
        title: "Reading Time per month",
        data: analytics.trends.readingMinutesByMonth,
        unit: "minutes" as const,
      };
    }

    return {
      title: "Books finished per month",
      data: analytics.trends.booksFinishedByMonth,
      unit: "books" as const,
    };
  }, [
    analytics.trends.booksFinishedByMonth,
    analytics.trends.pagesReadByMonth,
    analytics.trends.readingMinutesByMonth,
    monthlyTrendMetric,
  ]);
  const routeCategory = parseAnalyticsCategory(category);

  if (category && routeCategory === null) {
    return <Navigate to="/analytics" replace />;
  }

  if (routeCategory) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <Link to="/analytics" className="text-sm font-medium text-primary hover:underline">
            &lt;- Back to Analytics
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-heading leading-snug font-medium">{getAnalyticsCategoryTitle(routeCategory)}</h1>
            <p className="text-sm text-muted-foreground">{getAnalyticsCategoryDescription(routeCategory)}</p>
          </div>
        </div>

        {booksError || genresError ? <p className="text-sm text-destructive">{booksError || genresError}</p> : null}
        {logsError ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-destructive">
            <span>{logsError}</span>
            <Button type="button" variant="outline" size="sm" onClick={loadReadingLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : null}

        <AnalyticsCategoryPanel
          activeCategory={routeCategory}
          analytics={analytics}
          habits={habits}
          books={books}
          logs={logs}
          genres={genres}
          genresError={booksError || genresError}
          booksLoading={booksLoading}
          series={series}
          seriesLoading={seriesLoading}
          seriesError={seriesError}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-heading leading-snug font-medium">Analytics</h1>
        <p className="text-sm text-muted-foreground">Lifetime reading patterns from your books and progress logs.</p>
      </div>

      {booksError || genresError ? <p className="text-sm text-destructive">{booksError || genresError}</p> : null}
      {logsError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>{logsError}</span>
          <Button type="button" variant="outline" size="sm" onClick={loadReadingLogs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : null}

      <Section title="Key Statistics" description="The main lifetime numbers for completed books and tracked reading.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Books Finished"
            value={isLoading ? "..." : formatNumber(analytics.overview.booksFinished)}
            icon={BookOpen}
          />
          <StatCard
            label="Pages Read"
            value={isLoading ? "..." : formatNumber(analytics.overview.pagesRead)}
            detail="Finished books only"
            icon={Layers3}
          />
          <StatCard
            label="Reading Time"
            value={isLoading ? "..." : formatReadingTime(analytics.overview.readingMinutes)}
            detail="Finished and currently reading books"
            icon={Clock}
          />
          <StatCard
            label="Average Pace"
            value={isLoading ? "..." : formatPace(analytics.overview.averagePace)}
            detail="From progress-log page deltas"
            icon={Gauge}
          />
        </div>
      </Section>

      <div className="space-y-10">
        <Section title="Reading Trend" description="Monthly charts based on when reading activity or finishes happened.">
          <SimpleBarChart
            title={monthlyTrendChart.title}
            data={monthlyTrendChart.data}
            unit={monthlyTrendChart.unit}
            action={
              <div className="inline-flex rounded-md bg-background p-1">
                {(["books", "pages", "minutes"] as MonthlyTrendMetric[]).map((metric) => (
                  <Button
                    key={metric}
                    type="button"
                    variant={monthlyTrendMetric === metric ? "default" : "ghost"}
                    size="xs"
                    onClick={() => setMonthlyTrendMetric(metric)}
                  >
                    {metric === "minutes" ? "Time" : metric[0].toUpperCase() + metric.slice(1)}
                  </Button>
                ))}
              </div>
            }
          />
        </Section>

        <Section title="Reading Heatmap" description="Daily reading activity from your progress logs.">
          {logsLoading ? (
            <div className="h-44 animate-pulse rounded-lg bg-muted/30" />
          ) : logsError ? null : (
            <ReadingHeatmap logs={logs} />
          )}
        </Section>
      </div>

      <Section title="Analytics Categories" description="Open focused analytics by library area.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CategoryCard
            title="Genre Analytics"
            description="Distribution, evolution, ratings, and abandoned genres."
            icon={Layers3}
            to="/analytics/genre"
          />
          <CategoryCard
            title="Author Analytics"
            description="Author loyalty, ratings, favorites, and rereads."
            icon={Users}
            to="/analytics/author"
          />
          <CategoryCard
            title="Book Analytics"
            description="Book completion, pages, time, pace, formats, and records."
            icon={BarChart3}
            to="/analytics/book"
          />
          <CategoryCard
            title="Series Analytics"
            description="Series progress, completion, and library coverage."
            icon={BookOpen}
            to="/analytics/series"
          />
        </div>
      </Section>
    </div>
  );
}
