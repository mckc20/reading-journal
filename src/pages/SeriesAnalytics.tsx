import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { SeriesAnalyticsFull } from "@/components/series/SeriesAnalyticsSections";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { fetchAllBookNotes } from "@/lib/bookNotes";
import { fetchReadingLogs } from "@/lib/books";
import { filterSeriesLogs, getSeriesStats, sortSeriesBooks } from "@/lib/seriesDetails";
import type { BookNote, ReadingLog } from "@/types";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-background/55 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function SeriesAnalytics() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [notes, setNotes] = useState<BookNote[]>([]);

  const seriesRecord = series.find((item) => item.id === seriesId) ?? null;
  const seriesBooks = useMemo(
    () => sortSeriesBooks(books.filter((book) => book.series_id === seriesId)),
    [books, seriesId],
  );
  const seriesLogs = useMemo(() => filterSeriesLogs(seriesBooks, logs), [logs, seriesBooks]);
  const stats = useMemo(() => getSeriesStats(seriesBooks, seriesLogs, notes), [notes, seriesBooks, seriesLogs]);

  useEffect(() => {
    if (!seriesId) {
      setLogsLoading(false);
      return;
    }

    let ignore = false;

    fetchReadingLogs()
      .then((data) => {
        if (!ignore) setLogs(data);
      })
      .catch((error) => {
        if (!ignore) setLogsError(error instanceof Error ? error.message : "Failed to load reading activity");
      })
      .finally(() => {
        if (!ignore) setLogsLoading(false);
      });

    fetchAllBookNotes()
      .then((data) => {
        if (!ignore) setNotes(data);
      })
      .catch(() => {
        if (!ignore) setNotes([]);
      });

    return () => {
      ignore = true;
    };
  }, [seriesId]);

  if (booksLoading || seriesLoading || logsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  if (booksError || seriesError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{booksError || seriesError}</div>;
  }

  if (!seriesRecord) {
    return (
      <div className="space-y-4">
        <BackButton fallbackTo="/series" />
        <EmptyState message="This series was not found in your library." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackButton fallbackTo={`/series/${seriesRecord.id}`} />
      <header>
        <p className="text-sm font-medium text-muted-foreground">{seriesRecord.name}</p>
        <h1 className="mt-1 font-heading text-3xl font-medium leading-tight">Analytics</h1>
      </header>
      {seriesBooks.length === 0 ? (
        <EmptyState message="Books added to this series will appear here." />
      ) : (
        <SeriesAnalyticsFull stats={stats} logsLoading={logsLoading} logsError={logsError} />
      )}
    </div>
  );
}
