import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Heart } from "lucide-react";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { buildSeriesGroups, type SeriesBookGroup } from "@/lib/libraryShelves";
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

function EmptySeriesCard({
  group,
  onSeries,
}: {
  group: SeriesBookGroup;
  onSeries: (seriesId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSeries(group.seriesId)}
      className="group block w-full min-w-0 rounded-lg text-left transition-shadow duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative mx-auto h-[145px] w-[122px] sm:h-[178px] sm:w-[148px]">
        <div className="absolute left-0 top-2 flex h-[135px] w-[90px] items-center justify-center overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border transition-colors group-hover:bg-muted/80 sm:h-[168px] sm:w-[112px]">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          {group.isFavorite && (
            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow-sm ring-1 ring-border">
              <Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
              <span className="sr-only">Favorite series</span>
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 min-w-0">
        <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground">
          {group.name}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">0 books</p>
      </div>
    </button>
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
            group.books.length === 0 ? (
              <EmptySeriesCard key={group.seriesId} group={group} onSeries={openSeries} />
            ) : (
              <SeriesStackCard key={group.seriesId} group={group} onSeries={openSeries} showFavorite />
            )
          ))}
        </div>
      )}
    </div>
  );
}
