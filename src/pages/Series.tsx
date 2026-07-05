import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { buildSeriesGroups } from "@/lib/libraryShelves";
import SeriesStackCard from "@/pages/library/SeriesStackCard";

function LoadingSeriesGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(122px,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fit,minmax(148px,1fr))] sm:gap-x-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="min-w-0">
          <div className="mx-auto h-[145px] max-w-[148px] animate-pulse rounded-md bg-muted sm:h-[178px]" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default function Series() {
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const navigate = useNavigate();
  const groups = useMemo(() => buildSeriesGroups(books, series, { includeEmpty: true }), [books, series]);
  const loading = booksLoading || seriesLoading;
  const error = booksError || seriesError;

  function openSeries(seriesId: string) {
    navigate(`/series/${seriesId}`);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-heading leading-snug font-medium">Series</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the series in your library.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : loading ? (
        <LoadingSeriesGrid />
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Series you add will appear here.
          </p>
        </div>
      ) : (
        <div
          aria-label="Series collection"
          className="grid grid-cols-[repeat(auto-fit,minmax(122px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fit,minmax(148px,1fr))] sm:gap-x-6"
        >
          {groups.map((group) => (
            <SeriesStackCard key={group.seriesId} group={group} onSeries={openSeries} />
          ))}
        </div>
      )}
    </div>
  );
}
