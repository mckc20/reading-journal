import { useEffect, useMemo, useState, type ComponentType } from "react";
import { BarChart3, CalendarClock, CalendarRange, ChevronDown, ChevronUp, Clock, ClockFading } from "lucide-react";
import { AppHeading } from "@/components/design";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProgressOverTimeChart, {
  type ProgressOverTimeChartMode,
} from "@/components/ProgressOverTimeChart";
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

interface ReadingLogWithDelta extends ReadingLog {
  pagesReadDelta: number;
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

function AnalyticsStatBox({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 transition-colors">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm font-medium leading-tight">{value}</p>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

function AnalyticsOverviewStat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 p-4">
      <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-heading text-xl font-semibold">
          <span>{value}</span>
          {detail ? (
            <span className="font-sans text-xs font-normal text-muted-foreground">{detail}</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export default function BookAnalyticsPanel({ book }: BookAnalyticsPanelProps) {
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [timelineMode, setTimelineMode] = useState<ProgressOverTimeChartMode>("progress");

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

  const entries = useMemo(() => [...logsWithDelta].reverse(), [logsWithDelta]);
  const hasMoreEntries = entries.length > 3;
  const visibleEntries = useMemo(
    () => (showAllEntries || !hasMoreEntries ? entries : entries.slice(0, 3)),
    [entries, hasMoreEntries, showAllEntries]
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
        <section className="space-y-3">
          <div className="overflow-hidden rounded-xl border shadow-[var(--shadow-card)]">
            <div className="grid sm:grid-cols-2">
              <div className="border-b sm:border-b-0 sm:border-r">
                <AnalyticsOverviewStat
                  label="Total time spent reading"
                  value={totalReadingTimeLabel}
                  icon={Clock}
                />
              </div>
              <div>
                <AnalyticsOverviewStat
                  label="Reading duration"
                  value={readingDurationLabel}
                  detail={readingDuration.isAvailable && readingDuration.isInProgress ? "In progress" : undefined}
                  icon={CalendarRange}
                />
              </div>
            </div>
          </div>
        </section>

        {estimatedFinish.shouldShow && (
          <section className="space-y-3 pt-5">
            <AppHeading level={2} as="h2">Estimated Finish</AppHeading>
            {estimatedFinish.isAvailable && estimatedFinish.finishDate ? (
              <p className="text-xs text-muted-foreground">
                {formatEstimateConfidence(estimatedFinish.confidence)} · Based on{" "}
                {estimatedFinish.readingSessionCount} reading session
                {estimatedFinish.readingSessionCount === 1 ? "" : "s"} and your average speed for
                this book.
              </p>
            ) : null}
            {estimatedFinish.isAvailable && estimatedFinish.finishDate ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <AnalyticsStatBox
                  label="Finish date"
                  value={formatFinishDate(estimatedFinish.finishDate)}
                  icon={CalendarClock}
                />
                <AnalyticsStatBox
                  label="Reading time left"
                  value={
                    estimatedFinish.remainingMinutes
                      ? formatReadingTime(estimatedFinish.remainingMinutes) ?? "Not enough timed sessions"
                      : "Not enough timed sessions"
                  }
                  icon={ClockFading}
                />
              </div>
            ) : (
              <AnalyticsStatBox
                label="Estimated Finish"
                value="Not enough data yet"
                detail={`Log at least ${MIN_READING_LOGS_FOR_ESTIMATED_FINISH} progress updates to estimate this.`}
                icon={CalendarClock}
              />
            )}
          </section>
        )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {timelineMode === "progress" ? "Progress over time" : "Speed over time"}
          </p>
          <div className="inline-flex rounded-md bg-background p-1">
            {(["progress", "speed"] as ProgressOverTimeChartMode[]).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={timelineMode === mode ? "default" : "ghost"}
                size="xs"
                onClick={() => setTimelineMode(mode)}
              >
                {mode === "progress" ? "Progress" : "Speed"}
              </Button>
            ))}
          </div>
        </div>

        <ProgressOverTimeChart
          logs={logs}
          totalPages={book.total_pages}
          pausePeriods={book.pause_periods}
          mode={timelineMode}
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
