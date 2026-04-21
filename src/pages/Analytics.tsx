import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ReadingHeatmap from "@/components/ReadingHeatmap";
import GenreDistributionChart from "@/components/GenreDistributionChart";
import { useBooksContext } from "@/context/BooksContext";
import { fetchReadingLogsInRange } from "@/lib/books";
import {
  calculateReadingHabits,
  formatDurationMinutes,
  formatMinutesCompact,
  formatPagesPerHour,
} from "@/lib/readingHabits";
import type { ReadingLog } from "@/types";

function getHeatmapRangeIso(): { startIso: string; endIso: string } {
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

  const range = useMemo(() => getHeatmapRangeIso(), []);
  const habits = useMemo(
    () => calculateReadingHabits(logs, range.startIso, range.endIso),
    [logs, range.endIso, range.startIso]
  );

  async function loadHeatmapLogs() {
    try {
      setLoading(true);
      setHeatmapError(null);
      const data = await fetchReadingLogsInRange(range.startIso, range.endIso);
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
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Reading overview</CardTitle>
            <CardDescription>High-level stats from your library.</CardDescription>
          </div>
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
                    ? `${habits.usualTime.dominantHourLabel} is your most common hour window`
                    : "No dominant reading hour yet"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {habits.usualTime.dayParts.map((part) => (
                    <div key={part.label} className="rounded-md border bg-muted/20 px-3 py-2">
                      <p className="text-xs text-muted-foreground">{part.label}</p>
                      <p className="text-base font-medium">{part.sessions}</p>
                      <p className="text-[11px] text-muted-foreground">{part.percentage.toFixed(0)}% of sessions</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-4 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Weekday patterns (average per week)</p>
                {habits.weekdays.highest && habits.weekdays.lowest ? (
                  <div className="mt-3 rounded-md border">
                      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_7.5rem] gap-2 border-b bg-muted/20 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <p>Weekday</p>
                        <p className="text-right">Min/week</p>
                        <p className="text-right">Sessions/week</p>
                      </div>
                      {habits.weekdays.all.map((day) => {
                        const isMost = day.weekdayLabel === habits.weekdays.highest?.weekdayLabel;
                        const isLeast = day.weekdayLabel === habits.weekdays.lowest?.weekdayLabel;
                        return (
                          <div
                            key={day.weekdayLabel}
                            className="grid grid-cols-[minmax(0,1fr)_5.5rem_7.5rem] items-center gap-2 border-b bg-background px-3 py-2 text-sm last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{day.weekdayLabel}</span>
                              {isMost && isLeast ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Most & least
                                </Badge>
                              ) : isMost ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Most active
                                </Badge>
                              ) : isLeast ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Least active
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-right font-medium tabular-nums">{day.avgMinutesPerWeek.toFixed(1)}</p>
                            <p className="text-right font-medium tabular-nums">{day.avgSessionsPerWeek.toFixed(1)}</p>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add more reading sessions to establish weekday trends.
                  </p>
                )}
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
