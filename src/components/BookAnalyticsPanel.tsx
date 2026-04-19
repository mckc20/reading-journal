import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchReadingLogsForBook } from "@/lib/books";
import type { Book, ReadingLog } from "@/types";

interface BookAnalyticsPanelProps {
  book: Book;
}

interface ChartPoint {
  dayKey: string;
  dayLabel: string;
  pagesRead: number;
}

interface ReadingLogWithDelta extends ReadingLog {
  pagesReadDelta: number;
}

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayFromKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDayLabel(date: Date): string {
  return String(date.getDate());
}

function formatFullDayLabel(dayKey: string): string {
  return dayFromKey(dayKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatReadingTime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export default function BookAnalyticsPanel({ book }: BookAnalyticsPanelProps) {
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);

  async function loadLogs() {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await fetchReadingLogsForBook(book.id);
      setLogs(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await fetchReadingLogsForBook(book.id);
        if (!cancelled) {
          setLogs(data);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to load analytics");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  const logsWithDelta = useMemo<ReadingLogWithDelta[]>(() => {
    let previousPage = 0;
    return logs.map((log) => {
      const pagesReadDelta = Math.max(0, log.current_page - previousPage);
      previousPage = log.current_page;
      return {
        ...log,
        pagesReadDelta,
      };
    });
  }, [logs]);

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (logsWithDelta.length === 0) return [];

    const dailyTotals = new Map<string, number>();
    for (const log of logsWithDelta) {
      const dayKey = toLocalDayKey(new Date(log.logged_at));
      const current = dailyTotals.get(dayKey) ?? 0;
      dailyTotals.set(dayKey, current + log.pagesReadDelta);
    }

    const keys = [...dailyTotals.keys()].sort();
    const first = dayFromKey(keys[0]);
    const last = dayFromKey(keys[keys.length - 1]);
    const points: ChartPoint[] = [];

    const cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    while (cursor <= last) {
      const dayKey = toLocalDayKey(cursor);
      points.push({
        dayKey,
        dayLabel: formatDayLabel(cursor),
        pagesRead: dailyTotals.get(dayKey) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return points;
  }, [logsWithDelta]);

  const entries = useMemo(() => [...logsWithDelta].reverse(), [logsWithDelta]);

  const totalPagesRead = useMemo(
    () => chartPoints.reduce((sum, point) => sum + point.pagesRead, 0),
    [chartPoints]
  );

  const activeDays = useMemo(
    () => chartPoints.filter((point) => point.pagesRead > 0).length,
    [chartPoints]
  );

  const avgPerDay = useMemo(() => {
    if (chartPoints.length === 0) return 0;
    return totalPagesRead / chartPoints.length;
  }, [chartPoints.length, totalPagesRead]);

  const labelStep = useMemo(() => {
    if (chartPoints.length <= 14) return 1;
    if (chartPoints.length <= 28) return 2;
    if (chartPoints.length <= 42) return 3;
    if (chartPoints.length <= 56) return 4;
    return 7;
  }, [chartPoints.length]);

  const activePoint = useMemo(() => {
    if (!activeDayKey || chartPoints.length === 0) return null;
    return chartPoints.find((point) => point.dayKey === activeDayKey) ?? null;
  }, [activeDayKey, chartPoints]);

  const activePointIndex = useMemo(() => {
    if (!activePoint) return -1;
    return chartPoints.findIndex((point) => point.dayKey === activePoint.dayKey);
  }, [activePoint, chartPoints]);

  const tooltipLeft = useMemo(() => {
    if (activePointIndex < 0) return 0;
    const rawLeft = 20 + activePointIndex * 40;
    const maxLeft = Math.max(44, chartPoints.length * 40 - 44);
    return Math.min(Math.max(rawLeft, 44), maxLeft);
  }, [activePointIndex, chartPoints.length]);

  const maxPages = Math.max(...chartPoints.map((p) => p.pagesRead), 0);
  const yAxisMax = maxPages > 0 ? maxPages : 1;
  const yTicks = [yAxisMax, Math.ceil(yAxisMax / 2), 0];

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
        <div className="h-44 animate-pulse rounded-lg border bg-muted/30" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="py-3 space-y-3">
        <p className="text-sm text-destructive">{errorMsg}</p>
        <Button type="button" variant="outline" size="sm" onClick={loadLogs}>
          Retry
        </Button>
      </div>
    );
  }

  if (logsWithDelta.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">No reading progress entries yet.</p>
        <p className="text-xs text-muted-foreground">
          Log progress in the Properties tab to see analytics.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0 pr-2">
      <div className="space-y-3 py-2">
      <section className="rounded-lg border bg-muted/20 p-3 space-y-3">
        <div>
          <p className="text-sm font-medium">Pages read per day</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border bg-background/80 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total pages</p>
            <p className="text-sm font-medium">{totalPagesRead}</p>
          </div>
          <div className="rounded-md border bg-background/80 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active days</p>
            <p className="text-sm font-medium">{activeDays}</p>
          </div>
          <div className="rounded-md border bg-background/80 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg/day</p>
            <p className="text-sm font-medium">{avgPerDay.toFixed(1)}</p>
          </div>
        </div>

        <div className="grid grid-cols-[2rem_1fr] gap-2">
          <div className="h-44 flex flex-col justify-between text-[10px] text-muted-foreground">
            {yTicks.map((tick, index) => (
              <span key={`${tick}-${index}`}>{tick}</span>
            ))}
          </div>

          <div className="min-w-0">
            <div className="overflow-x-auto overflow-y-hidden">
              <div className="min-w-max space-y-2 px-1">
                <div className="relative h-44">
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    <div className="border-t border-border/70" />
                    <div className="border-t border-border/50" />
                    <div className="border-t border-border/70" />
                  </div>

                  <div className="relative flex h-full items-end gap-2">
                    {activePoint && activePointIndex >= 0 && (
                      <div
                        className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
                        style={{ left: `${tooltipLeft}px` }}
                      >
                        {formatFullDayLabel(activePoint.dayKey)}: {activePoint.pagesRead} page{activePoint.pagesRead === 1 ? "" : "s"}
                      </div>
                    )}
                    {chartPoints.map((point) => {
                      const chartHeightPx = 176; // h-44 = 11rem = 176px
                      const normalizedHeight = Math.round((point.pagesRead / yAxisMax) * chartHeightPx);
                      const barHeight = point.pagesRead > 0 ? Math.max(normalizedHeight, 4) : 0;
                      return (
                        <button
                          key={point.dayKey}
                          type="button"
                          className="flex w-8 shrink-0 items-end rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                          onMouseEnter={() => setActiveDayKey(point.dayKey)}
                          onMouseLeave={() => setActiveDayKey(null)}
                          onFocus={() => setActiveDayKey(point.dayKey)}
                          onBlur={() => setActiveDayKey(null)}
                          aria-label={`${formatFullDayLabel(point.dayKey)}: ${point.pagesRead} page${point.pagesRead === 1 ? "" : "s"} read`}
                        >
                          <div
                            className="w-full rounded-t-sm bg-primary/85 transition-colors hover:bg-primary"
                            style={{ height: `${barHeight}px` }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  {chartPoints.map((point, index) => (
                    <span
                      key={point.dayKey}
                      className="w-8 shrink-0 text-center text-[10px] text-muted-foreground"
                    >
                      {chartPoints.length <= 10 || index === 0 || index === chartPoints.length - 1 || index % labelStep === 0
                        ? point.dayLabel
                        : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-muted/20 p-3">
        <p className="text-sm font-medium">Reading progress entries</p>
        <div className="mt-3 space-y-2 pb-1">
          {entries.map((entry) => {
            const timeLabel = formatReadingTime(entry.reading_time_minutes);
            return (
              <div
                key={entry.id || `${entry.logged_at}-${entry.current_page}`}
                className="w-full min-w-0 rounded-md border bg-background/80 p-2.5"
              >
                <p className="text-xs text-muted-foreground">{formatDateTime(entry.logged_at)}</p>
                <div className="mt-1 flex flex-wrap items-start justify-between gap-1.5">
                  <p className="text-sm">Reached page {entry.current_page}</p>
                  <p className="text-sm font-medium sm:text-right">+{entry.pagesReadDelta} pages</p>
                </div>
                {timeLabel && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Reading time: {timeLabel}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
      </div>
    </ScrollArea>
  );
}
