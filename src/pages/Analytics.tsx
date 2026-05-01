import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReadingHeatmap from "@/components/ReadingHeatmap";
import GenreDistributionChart from "@/components/GenreDistributionChart";
import WeekdayPatternsChart from "@/components/WeekdayPatternsChart";
import { useBooksContext } from "@/context/BooksContext";
import { fetchReadingLogs } from "@/lib/books";
import {
  calculateReadingHabits,
  formatDurationMinutes,
  formatMinutesCompact,
  formatPagesPerHour,
} from "@/lib/readingHabits";
import type { ReadingLog } from "@/types";

const DAY_PART_HOUR_RANGES: Record<string, string> = {
  Morning: "06:00-11:59",
  Afternoon: "12:00-17:59",
  Evening: "18:00-22:59",
  Night: "23:00-05:59",
};

function getHabitsRangeIso(): { startIso: string; endIso: string } {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
  };
}

export default function Analytics() {
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const finishedBooks = books.filter((book) => book.status === "Finished").length;
  const readingBooks = books.filter((book) => book.status === "Reading").length;
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);

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

  async function loadHeatmapLogs() {
    try {
      setLoading(true);
      setHeatmapError(null);
      const data = await fetchReadingLogs();
      setLogs(data);
    } catch (err) {
      setHeatmapError(err instanceof Error ? err.message : "Failed to load reading activity");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHeatmapLogs();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading leading-snug font-medium">Analytics</h1>

      <Card>
        <CardHeader>
          <CardTitle>Reading overview</CardTitle>
          <CardDescription>High-level stats from your library.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Total books</p>
              <p className="mt-1 text-2xl font-semibold">{books.length}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Currently reading</p>
              <p className="mt-1 text-2xl font-semibold">{readingBooks}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Finished</p>
              <p className="mt-1 text-2xl font-semibold">{finishedBooks}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="">
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 w-48 animate-pulse rounded bg-muted/50" />
              <div className="h-44 animate-pulse rounded-lg border bg-muted/30" />
            </div>
          ) : heatmapError ? (
            <div className="space-y-3 py-1">
              <p className="text-sm text-destructive">{heatmapError}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadHeatmapLogs}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : (
            <ReadingHeatmap logs={logs} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reading habits</CardTitle>
          <CardDescription>Patterns from your logged sessions in the last 12 months.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="h-28 animate-pulse rounded-lg border bg-muted/30" />
              <div className="h-28 animate-pulse rounded-lg border bg-muted/30" />
              <div className="h-36 animate-pulse rounded-lg border bg-muted/30 sm:col-span-2" />
            </div>
          ) : heatmapError ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{heatmapError}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadHeatmapLogs}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : habits.totalLogs === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              No reading logs in this range yet. Add progress entries to unlock reading habit insights.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Average reading duration</p>
                {habits.duration.averageMinutes === null ? (
                  <p className="mt-2 text-sm text-muted-foreground">No tracked reading time yet.</p>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-semibold">
                      {formatDurationMinutes(habits.duration.averageMinutes)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Typical session: {formatMinutesCompact(habits.duration.averageMinutes)} across{" "}
                      {habits.duration.sessionsUsed} session
                      {habits.duration.sessionsUsed === 1 ? "" : "s"}
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Average reading speed</p>
                {habits.speed.averagePagesPerHour === null ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Not enough page-progress and reading-time data for speed yet.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-semibold">
                      {formatPagesPerHour(habits.speed.averagePagesPerHour)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Weighted by reading time from {habits.speed.sessionsUsed} session
                      {habits.speed.sessionsUsed === 1 ? "" : "s"}
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-lg border p-4 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Usual reading time</p>
                <p className="mt-1 text-lg font-semibold">
                  {habits.usualTime.dominantHourLabel
                    ? habits.usualTime.dominantHourLabel
                    : "No dominant reading hour yet"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {habits.usualTime.dayParts.map((part) => (
                    <div key={part.label} className="rounded-md border bg-muted/20 px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        {part.label} ({DAY_PART_HOUR_RANGES[part.label]})
                      </p>
                      <p className="text-base font-medium">{part.percentage.toFixed(0)}%</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatMinutesCompact(part.minutes)} of tracked minutes
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-4 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Weekday patterns (median per week)</p>
                <WeekdayPatternsChart weekdays={habits.weekdays} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Genre distribution</CardTitle>
          <CardDescription>See how your library is split across genres.</CardDescription>
        </CardHeader>
        <CardContent>
          <GenreDistributionChart books={books} loading={booksLoading} error={booksError} />
        </CardContent>
      </Card>
    </div>
  );
}
