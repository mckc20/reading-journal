import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarDays,
  Clock,
  Gauge,
  Layers3,
  Medal,
  RefreshCw,
  Trophy,
} from "lucide-react";

import ReadingHeatmap from "@/components/ReadingHeatmap";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import {
  buildAnalyticsDashboardData,
  type AnalyticsDashboardData,
  type TimeBucket,
} from "@/lib/analyticsDashboard";
import { fetchReadingLogs } from "@/lib/books";
import { calculateReadingHabits } from "@/lib/readingHabits";
import { cn } from "@/lib/utils";
import type { Book, ReadingLog, Series } from "@/types";

type MonthlyTrendMetric = "books" | "pages" | "minutes";
type AnalyticsCategory = "author" | "genre" | "series" | "book";

function getAnalyticsCategoryTitle(category: AnalyticsCategory): string {
  if (category === "author") return "Author Analytics";
  if (category === "genre") return "Genre Analytics";
  if (category === "series") return "Series Analytics";
  return "Book Analytics";
}

function getAnalyticsCategoryDescription(category: AnalyticsCategory): string {
  if (category === "author") return "Author-level summary stats from your library.";
  if (category === "genre") return "Genre summary stats from your finished books.";
  if (category === "series") return "Series coverage across your library.";
  return "Cumulative pages, reading time habits, speed trend, and book insights.";
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

function formatSpeed(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "No data";
  return `${value.toFixed(1)} pages/hour`;
}

function formatChartValue(value: number, unit: "books" | "pages" | "minutes" | "hours" | "speed" | "days"): string {
  if (unit === "books") return `${formatNumber(value)} book${Math.round(value) === 1 ? "" : "s"}`;
  if (unit === "days") return `${formatNumber(value)} day${Math.round(value) === 1 ? "" : "s"}`;
  if (unit === "pages") return `${formatNumber(value)} pages`;
  if (unit === "minutes") return formatReadingTime(value);
  if (unit === "hours") return `${value.toFixed(value >= 10 ? 0 : 1)}h`;
  return `${value.toFixed(1)} pages/hour`;
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
  unit: "books" | "pages" | "minutes" | "speed" | "days";
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
                    : unit === "speed"
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
  unit: "pages" | "speed";
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
                  {unit === "speed" ? tick.toFixed(1) : formatNumber(Math.round(tick))}
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
                  aria-label="Line chart showing average reading speed over time"
                >
                  <defs>
                    <linearGradient id="average-speed-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.34" />
                      <stop offset="70%" stopColor="var(--primary)" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={areaPoints} fill="url(#average-speed-fill)" />
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
                    aria-label={`${point.label}: ${unit === "speed" ? formatChartValue(point.value, "speed") : formatChartValue(point.value, "pages")}`}
                    title={`${point.label}: ${unit === "speed" ? formatChartValue(point.value, "speed") : formatChartValue(point.value, "pages")}`}
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
        ongoing: seriesBooks.some((book) => book.status === "Reading" || book.status === "Paused" || book.status === "Up Next" || book.status === "To Read"),
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
    <SeriesSummary data={data} />
  );
}

function SeriesSummary({
  data,
}: {
  data: ReturnType<typeof buildSeriesAnalytics>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DetailStat label="Series" value={formatNumber(data.totalSeries)} />
      <DetailStat label="Books in series" value={formatNumber(data.booksInSeries)} />
      <DetailStat label="Completed series" value={formatNumber(data.completedSeries)} />
      <DetailStat label="Ongoing series" value={formatNumber(data.ongoingSeries)} />
      <DetailStat
        label="Favorite series"
        value={data.favoriteSeries ? `${data.favoriteSeries.name} · ${formatRating(data.favoriteSeries.averageRating)}` : "No data"}
      />
    </div>
  );
}

function AuthorSummary({
  analytics,
}: {
  analytics: AnalyticsDashboardData;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DetailStat label="Favorite Author" value={analytics.insights.favoriteAuthor ?? "No data"} />
      <DetailStat label="Most Reread Author" value={analytics.insights.mostRereadAuthor ?? "No data"} />
    </div>
  );
}

function GenreAnalyticsContent({
  analytics,
  genreCategory,
}: {
  analytics: AnalyticsDashboardData;
  genreCategory: ReturnType<typeof buildGenreCategoryAnalytics>;
}) {
  return (
    <div className="space-y-4">
      <DetailSection title="Genre Insights">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailStat label="Favorite Genre" value={analytics.insights.favoriteGenre ?? "No data"} />
          <DetailStat label="Genre Explored Most This Year" value={analytics.insights.genreExploredMostThisYear ?? "No data"} />
          <DetailStat label="Genre Diversity" value={`${formatNumber(genreCategory.totalGenres)} genres`} />
          <DetailStat label="Genres This Year" value={formatNumber(genreCategory.genresThisYear)} />
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
    </div>
  );
}

function BookAnalyticsContent({
  analytics,
  habits,
}: {
  analytics: AnalyticsDashboardData;
  habits: ReturnType<typeof calculateReadingHabits>;
}) {
  return (
    <div className="space-y-4">
      <DetailSection title="Speed">
        <LineChart title="Speed Trend" data={analytics.trends.averageSpeedByMonth} unit="speed" empty="No speed data yet." />
      </DetailSection>
      <DetailSection title="Insights">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Usual Reading Hour"
            value={habits.usualTime.dominantHourLabel ?? "No data"}
            icon={Clock}
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
        </div>
      </DetailSection>
    </div>
  );
}

function AnalyticsCategoryPanel({
  activeCategory,
  analytics,
  habits,
  books,
  logs,
  series,
  seriesLoading,
  seriesError,
}: {
  activeCategory: AnalyticsCategory;
  analytics: AnalyticsDashboardData;
  habits: ReturnType<typeof calculateReadingHabits>;
  books: Book[];
  logs: ReadingLog[];
  series: Series[];
  seriesLoading: boolean;
  seriesError: string | null;
}) {
  const genreCategory = useMemo(() => buildGenreCategoryAnalytics(books, logs), [books, logs]);

  return (
    <div className="space-y-4">
      {activeCategory === "author" ? (
        <DetailSection title="Author Summary">
          <AuthorSummary analytics={analytics} />
        </DetailSection>
      ) : null}

      {activeCategory === "genre" ? (
        <GenreAnalyticsContent analytics={analytics} genreCategory={genreCategory} />
      ) : null}

      {activeCategory === "series" ? (
        <SeriesAnalyticsPanel books={books} series={series} loading={seriesLoading} error={seriesError} />
      ) : null}

      {activeCategory === "book" ? (
        <BookAnalyticsContent analytics={analytics} habits={habits} />
      ) : null}
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
  const genreCategory = useMemo(() => buildGenreCategoryAnalytics(books, logs), [books, logs]);
  const seriesCategory = useMemo(() => buildSeriesAnalytics(books, series), [books, series]);

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
    return <Navigate to="/statistics" replace />;
  }

  if (routeCategory) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <Link to="/statistics" className="text-sm font-medium text-primary hover:underline">
            &lt;- Back to Analytics
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-heading leading-snug font-medium">{getAnalyticsCategoryTitle(routeCategory)}</h1>
            <p className="text-sm text-muted-foreground">{getAnalyticsCategoryDescription(routeCategory)}</p>
          </div>
        </div>

        {booksError ? <p className="text-sm text-destructive">{booksError}</p> : null}
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

      {booksError ? <p className="text-sm text-destructive">{booksError}</p> : null}
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
            label="Average Speed"
            value={isLoading ? "..." : formatSpeed(analytics.overview.averageSpeed)}
            detail="From progress logs with reading time"
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

      <Section title="Genre Analytics" description="Genre insights and remaining genre summaries.">
        <GenreAnalyticsContent analytics={analytics} genreCategory={genreCategory} />
      </Section>

      <Section title="Author Analytics" description="Summary stats for the authors in your library.">
        <DetailSection title="Author Summary">
          <AuthorSummary analytics={analytics} />
        </DetailSection>
      </Section>

      <Section title="Book Analytics" description="Remaining book-level trends and insights.">
        <BookAnalyticsContent analytics={analytics} habits={habits} />
      </Section>

      <Section title="Series Analytics" description="Summary stats for your series library.">
        {seriesError ? <p className="text-sm text-destructive">{seriesError}</p> : null}
        {seriesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
            <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
          </div>
        ) : (
          <DetailSection title="Series Summary">
            <SeriesSummary data={seriesCategory} />
          </DetailSection>
        )}
      </Section>
    </div>
  );
}
