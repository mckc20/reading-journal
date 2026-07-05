import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { buildSeriesGroups } from "@/lib/libraryShelves";
import SeriesStackCard from "@/pages/library/SeriesStackCard";

function LoadingSeriesGrid() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="w-[122px] sm:w-[148px]">
          <div className="h-[145px] animate-pulse rounded-md bg-muted sm:h-[178px]" />
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
      <div>
        <h1 className="font-heading text-4xl font-bold leading-tight">Series</h1>
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
          className="flex flex-wrap gap-x-4 gap-y-7 sm:gap-x-6"
        >
          {groups.map((group) => (
            <SeriesStackCard key={group.seriesId} group={group} onSeries={openSeries} />
          ))}
        </div>
      )}
    </div>
  );
}
