import CollectionEmptyState from "@/components/CollectionEmptyState";
import { fetchReadingLogs } from "@/lib/books";
import type { SortDirection } from "@/lib/librarySorting";
import { sortLibrarySeries, seriesSortOptions, defaultSeriesSortDirection } from "@/lib/libraryEntitySorting";
import { useLibraryPresentation } from "@/components/redesign/LibraryNavigation";
import { compareLibraryItems } from "@/lib/libraryTabs";
import { cn } from "@/lib/utils";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { buildSeriesGroups, type SeriesBookGroup } from "@/lib/libraryShelves";
import { getDerivedSeriesStatus } from "@/lib/seriesDetails";
import SeriesStackCard from "@/pages/library/SeriesStackCard";

const seriesStatuses = ["Not Started", "Ongoing", "Completed", "DNF"] as const;

function getSeriesAuthors(group: SeriesBookGroup): string[] {
  return [...new Set(group.books.flatMap((book) => book.authors))];
}

export default function Series() {
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { sort: librarySort, view, sortChanged, animateLayout } = useLibraryPresentation();
  const librarySeries = useMemo(() => series.filter((item) => !item.is_wishlist_only), [series]);
  const allGroups = useMemo(() => buildSeriesGroups(books, librarySeries, { includeEmpty: true }), [books, librarySeries]);
  const loading = booksLoading || seriesLoading;
  const error = booksError || seriesError;
  const genreFilters = useMemo(() => searchParams.getAll("genre").filter(Boolean), [searchParams]);
  const statusFilters = useMemo(() => searchParams.getAll("status").filter((value) => seriesStatuses.includes(value as typeof seriesStatuses[number])), [searchParams]);
  const legacySort = sortChanged ? undefined : seriesSortOptions.find(option => option.value === searchParams.get("sort"))?.value;
  const sort = legacySort ?? (librarySort === "recent" ? "date-added" : "name");
  const directionParam = sortChanged ? null : searchParams.get("direction");
  const direction: SortDirection = directionParam === "asc" || directionParam === "desc" ? directionParam : defaultSeriesSortDirection(sort);
  const [latestReadTimesByBook, setLatestReadTimesByBook] = useState<Map<string, number>>(new Map());
  const [readingLogsLoaded, setReadingLogsLoaded] = useState(false);
  const [readingLogsError, setReadingLogsError] = useState(false);
  const seriesCreatedAtById = useMemo(() => new Map(librarySeries.map((item) => [item.id, item.created_at])), [librarySeries]);

  useEffect(() => {
    if (sort !== "last-read" || readingLogsLoaded) return;
    let cancelled = false;
    setReadingLogsError(false);
    fetchReadingLogs().then((logs) => {
      if (cancelled) return;
      const latest = new Map<string, number>();
      logs.forEach((log) => {
        const time = Date.parse(log.logged_at);
        if (Number.isFinite(time) && time > (latest.get(log.book_id) ?? -Infinity)) latest.set(log.book_id, time);
      });
      setLatestReadTimesByBook(latest);
    }).catch(() => {
      if (!cancelled) setReadingLogsError(true);
    }).finally(() => {
      if (!cancelled) setReadingLogsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [sort, readingLogsLoaded]);
  const activeFilterCount = genreFilters.length + statusFilters.length;
  const groups = useMemo(() => {
    const visible = allGroups.filter((group) => {
      if (statusFilters.length && !statusFilters.includes(getDerivedSeriesStatus(group.books))) return false;
      // Match whole series when any linked book has one of the selected genres.
      return !genreFilters.length || group.books.some((book) => (book.genres ?? []).some((genre) => genreFilters.includes(genre)));
    });
    if (!legacySort && librarySort === "author") {
      return visible.map(group => ({ group, title: group.name, author: getSeriesAuthors(group).sort().join(", ") }))
        .sort((a, b) => compareLibraryItems(a, b, "author"))
        .map(entry => entry.group);
    }
    return sortLibrarySeries(visible, sort, direction, { seriesCreatedAtById, latestReadTimesByBook });
  }, [allGroups, statusFilters, genreFilters, legacySort, librarySort, sort, direction, seriesCreatedAtById, latestReadTimesByBook]);

  function clearFilters() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("genre");
      next.delete("status");
      return next;
    }, { replace: true });
  }

  function openSeries(seriesId: string) {
    navigate(`/series/${seriesId}`);
  }

  return (
    <div key={view} className={cn("space-y-4", animateLayout && "rj-layout-enter")}>
      {sort === "last-read" && !readingLogsLoaded && <LoadingIndicator variant="inline" label="Loading reading order…" />}
      {sort === "last-read" && readingLogsError && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <p>Reading activity could not be loaded. Last Read currently uses book finish dates.</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setReadingLogsLoaded(false)}>Try again</Button>
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : loading ? (
        <LoadingIndicator variant="page" />
      ) : groups.length === 0 && activeFilterCount > 0 ? (
        <CollectionEmptyState title="No series match your filters"
          description="Clear the filters to see all your series." onShowAll={clearFilters} />
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Series you add will appear here.
          </p>
        </div>
      ) : view === "list" ? (
        <div aria-label="Series collection" className="bg-background">
          <table className="w-full table-fixed text-left text-sm">
            <tbody className="divide-y divide-border/70">
              {groups.map((group) => (
                <tr key={group.seriesId} className="group hover:bg-muted/50">
                  <td className="px-2 py-4 sm:px-3">
                    <button type="button" className="group flex w-full items-center gap-4 text-left" onClick={() => openSeries(group.seriesId)}>
                      <span className="relative h-[72px] w-12 shrink-0">
                        {group.books.slice(0, 3).map((book, index) => <span key={book.id} className="absolute top-0 h-[72px] w-12 overflow-hidden rounded-sm border border-background bg-muted" style={{ left: `${index * 3}px`, zIndex: 3 - index }}>{book.cover_url ? <img src={book.cover_url} alt="" className="h-full w-full object-cover" /> : <BookOpen className="m-1 h-4 w-4 text-muted-foreground/50" />}</span>)}
                        {group.books.length === 0 && <span className="flex h-[72px] w-12 items-center justify-center rounded-sm bg-muted"><BookOpen className="h-4 w-4 text-muted-foreground/50" /></span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-heading text-base leading-relaxed underline-offset-4 group-hover:underline group-focus-visible:underline sm:text-lg" style={{ maskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)" }}>{group.name}</span>
                        {getSeriesAuthors(group).length > 0 && <span className="mt-0.5 block truncate text-xs text-muted-foreground" style={{ maskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)" }}>{getSeriesAuthors(group).join(", ")}</span>}
                      </span>
                      <ChevronRight className="mr-3 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          aria-label="Series collection"
          className="grid grid-cols-[repeat(auto-fill,88px)] justify-between gap-8 sm:grid-cols-[repeat(auto-fill,126px)] lg:grid-cols-[repeat(auto-fill,140px)]"
        >
          {groups.map((group) => (
            <SeriesStackCard key={group.seriesId} group={group} onSeries={openSeries} showBookCount={false} variant="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
