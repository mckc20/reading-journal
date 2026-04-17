import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReadingHeatmap from "@/components/ReadingHeatmap";
import GenreDistributionChart from "@/components/GenreDistributionChart";
import { useBooksContext } from "@/context/BooksContext";
import { fetchReadingLogsInRange } from "@/lib/books";
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
        <CardHeader>
          <CardTitle>Genre distribution</CardTitle>
          <CardDescription>See how your library is split across genres.</CardDescription>
        </CardHeader>
        <CardContent>
          <GenreDistributionChart books={books} loading={booksLoading} error={booksError} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
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
    </div>
  );
}
