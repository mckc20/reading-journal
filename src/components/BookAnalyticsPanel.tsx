import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProgressOverTimeChart from "@/components/ProgressOverTimeChart";
import { VerticalBarChart } from "@/components/design";
import { fetchReadingLogsForBook } from "@/lib/books";
import {
  formatCalendarSpan,
  formatTotalReadingTime,
  getEstimatedFinish,
  getReadingDuration,
  MIN_READING_LOGS_FOR_ESTIMATED_FINISH,
  sumReadingMinutes,
} from "@/lib/bookAnalytics";
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

function formatFinishDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEstimateConfidence(confidence: "low" | "medium" | "high" | null): string {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  if (confidence === "low") return "Low confidence";
  return "Confidence unavailable";
}

export default function BookAnalyticsPanel({ book }: BookAnalyticsPanelProps) {
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);

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
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
    );

    return sortedLogs.map((log) => {
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
  const hasMoreEntries = entries.length > 3;
  const visibleEntries = useMemo(
    () => (showAllEntries || !hasMoreEntries ? entries : entries.slice(0, 3)),
    [entries, hasMoreEntries, showAllEntries]
  );

  const totalPagesRead = useMemo(
    () => chartPoints.reduce((sum, point) => sum + point.pagesRead, 0),
    [chartPoints]
  );

  const totalReadingMinutes = useMemo(() => sumReadingMinutes(logs), [logs]);

  const totalReadingTimeLabel = useMemo(
    () => formatTotalReadingTime(totalReadingMinutes),
    [totalReadingMinutes]
  );

  const estimatedFinish = useMemo(
    () =>
      getEstimatedFinish({
        status: book.status,
        currentPage: book.current_page,
        totalPages: book.total_pages,
        logs,
        pausePeriods: book.pause_periods,
      }),
    [book.current_page, book.pause_periods, book.status, book.total_pages, logs]
  );

  const readingDuration = useMemo(
    () =>
      getReadingDuration({
        dateStarted: book.date_started,
        dateFinished: book.date_finished,
        pausePeriods: book.pause_periods,
      }),
    [book.date_finished, book.date_started, book.pause_periods]
  );

  const readingDurationLabel = useMemo(() => {
    if (!readingDuration.isAvailable || !readingDuration.span) return "Not available";
    return formatCalendarSpan(readingDuration.span);
  }, [readingDuration.isAvailable, readingDuration.span]);

  const activeDays = useMemo(
    () => chartPoints.filter((point) => point.pagesRead > 0).length,
    [chartPoints]
  );

  const avgPerDay = useMemo(() => {
    if (chartPoints.length === 0) return 0;
    return totalPagesRead / chartPoints.length;
  }, [chartPoints.length, totalPagesRead]);

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
      <div className="space-y-3 py-2">
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">No reading progress entries yet.</p>
          <p className="text-xs text-muted-foreground">
            Log progress in the Properties tab to see analytics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0 pr-2">
      <div className="space-y-3 py-2">
        {estimatedFinish.shouldShow && (
          <section className="space-y-3">
            <p className="text-sm font-medium">Estimated finish</p>
            {estimatedFinish.isAvailable && estimatedFinish.finishDate ? (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border bg-background/80 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Finish date
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {formatFinishDate(estimatedFinish.finishDate)}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background/80 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Reading time left
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {estimatedFinish.remainingMinutes
                        ? formatReadingTime(estimatedFinish.remainingMinutes)
                        : "Not enough timed sessions"}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatEstimateConfidence(estimatedFinish.confidence)} · Based on{" "}
                  {estimatedFinish.readingSessionCount} reading session
                  {estimatedFinish.readingSessionCount === 1 ? "" : "s"} and your average speed for
                  this book.
                </p>
              </>
            ) : (
              <div className="mt-3 rounded-md border bg-background/80 px-2 py-2">
                <p className="text-sm font-medium">Not enough data yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Log at least {MIN_READING_LOGS_FOR_ESTIMATED_FINISH} progress updates to
                  estimate this.
                </p>
              </div>
            )}
          </section>
        )}

      <section className="space-y-3">
        <p className="text-sm font-medium">Time-based stats</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border bg-background/80 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total time spent reading
            </p>
            <p className="mt-1 text-sm font-medium">{totalReadingTimeLabel}</p>
          </div>
          <div className="rounded-md border bg-background/80 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reading duration</p>
            <p className="mt-1 text-sm font-medium">{readingDurationLabel}</p>
            {readingDuration.isAvailable && readingDuration.isInProgress && (
              <p className="mt-0.5 text-xs text-muted-foreground">In progress (to today)</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium">Progress over time</p>
        </div>

        <ProgressOverTimeChart
          logs={logs}
          totalPages={book.total_pages}
          pausePeriods={book.pause_periods}
        />
      </section>

      <section className="space-y-3">
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

        <VerticalBarChart
          data={chartPoints.map((point) => ({
            key: point.dayKey,
            label: point.dayLabel,
            value: point.pagesRead,
          }))}
          formatValue={(value) => `${Math.round(value)} page${Math.round(value) === 1 ? "" : "s"}`}
          yAxisClassName="grid-cols-[2rem_1fr]"
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Reading progress entries</p>
          <p className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>

        <div className="mt-3 overflow-hidden rounded-md border bg-background/80">
          {visibleEntries.map((entry) => {
            const timeLabel = formatReadingTime(entry.reading_time_minutes);
            return (
              <div
                key={entry.id || `${entry.logged_at}-${entry.current_page}`}
                className="flex min-w-0 flex-col gap-1.5 border-b px-2.5 py-2 last:border-b-0 sm:min-h-12 sm:flex-row sm:items-center sm:gap-8"
              >
                <div className="min-w-0 sm:flex-1">
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(entry.logged_at)}
                  </p>
                  <p className="mt-0.5 text-sm">Page {entry.current_page}</p>
                </div>
                <p className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">
                  {timeLabel ? `Reading time: ${timeLabel}` : "No reading time"}
                </p>
                <p className="text-sm font-medium sm:w-24 sm:shrink-0 sm:text-right">
                  +{entry.pagesReadDelta} page{entry.pagesReadDelta === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </div>

        {hasMoreEntries && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mt-2"
            onClick={() => setShowAllEntries((current) => !current)}
            aria-expanded={showAllEntries}
          >
            {showAllEntries ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show fewer
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show all {entries.length}
              </>
            )}
          </Button>
        )}
      </section>
      </div>
    </ScrollArea>
  );
}
