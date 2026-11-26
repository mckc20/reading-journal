import CollectionEmptyState from "@/components/CollectionEmptyState";
import { fetchReadingLogs } from "@/lib/books";
import type { SortDirection } from "@/lib/librarySorting";
import { sortLibrarySeries, seriesSortOptions, defaultSeriesSortDirection } from "@/lib/libraryEntitySorting";
import { useLibraryPresentation } from "@/components/redesign/LibraryNavigation";
import { compareLibraryItems } from "@/lib/libraryTabs";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { buildSeriesGroups, type SeriesBookGroup } from "@/lib/libraryShelves";
import { getDerivedSeriesStatus } from "@/lib/seriesDetails";
import { CollectionSearch } from "@/components/redesign/CollectionSearch";
import { LibrarySeriesEntries } from "@/components/redesign/LibrarySeriesEntries";
import { EmptyState } from "@/components/reading-journal/EmptyState";

const seriesStatuses = ["Not Started", "Ongoing", "Completed", "DNF"] as const;

function getSeriesAuthors(group: SeriesBookGroup): string[] {
  return [...new Set(group.books.flatMap((book) => book.authors))];
}

export default function Series() {
  const wishlistHeadingId = useId();
  const { books, wishlistBooks, loading: booksLoading, error: booksError } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const { sort: librarySort, sortChanged } = useLibraryPresentation();
  const wishlistGroups = useMemo(() => buildSeriesGroups(wishlistBooks, series), [wishlistBooks, series]);
  const libraryGroups = useMemo(() => {
    const wishedIds = new Set(wishlistGroups.map(group => group.seriesId));
    const ownedIds = new Set(books.map(book => book.series_id));
    const librarySeries = series.filter(item => ownedIds.has(item.id) || (!item.is_wishlist_only && !wishedIds.has(item.id)));
    return buildSeriesGroups(books, librarySeries, { includeEmpty: true });
  }, [books, series, wishlistGroups]);
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
  const seriesCreatedAtById = useMemo(() => new Map(series.map((item) => [item.id, item.created_at])), [series]);

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
  const [groups, wishedGroups] = useMemo(() => {
    function filterAndSort(allGroups: SeriesBookGroup[]) {
      const visible = allGroups.filter((group) => {
        if (statusFilters.length && !statusFilters.includes(getDerivedSeriesStatus(group.books))) return false;
        return !genreFilters.length || group.books.some((book) => (book.genres ?? []).some((genre) => genreFilters.includes(genre)));
      });
      if (!legacySort && librarySort === "author") {
        return visible.map(group => ({ group, title: group.name, author: getSeriesAuthors(group).sort().join(", ") }))
          .sort((a, b) => compareLibraryItems(a, b, "author"))
          .map(entry => entry.group);
      }
      return sortLibrarySeries(visible, sort, direction, { seriesCreatedAtById, latestReadTimesByBook });
    }
    return [filterAndSort(libraryGroups), filterAndSort(wishlistGroups)];
  }, [libraryGroups, wishlistGroups, statusFilters, genreFilters, legacySort, librarySort, sort, direction, seriesCreatedAtById, latestReadTimesByBook]);

  const needle = query.trim().toLocaleLowerCase();
  function searchEntries(groups: SeriesBookGroup[]) {
    return groups.filter(group => `${group.name} ${getSeriesAuthors(group).join(", ")}`.toLocaleLowerCase().includes(needle))
      .map(group => ({ id: group.seriesId, title: group.name, books: group.books }));
  }
  const visibleEntries = searchEntries(groups);
  const visibleWishes = searchEntries(wishedGroups);
  const hasGroups = groups.length > 0 || wishedGroups.length > 0;

  function clearFilters() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("genre");
      next.delete("status");
      return next;
    }, { replace: true });
  }

  function openSeries(seriesId: string) {
    navigate(`/series/${encodeURIComponent(seriesId)}`);
  }

  return (
    <CollectionSearch collection="Series" query={query} onQueryChange={setQuery}>
      {({ desktopSearch }) => <div className="rj-library-preview">
        <div className="rj-library-search-toolbar mb-6">{desktopSearch}</div>
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
        ) : !hasGroups && activeFilterCount > 0 ? (
          <CollectionEmptyState title="No series match your filters"
            description="Clear the filters to see all your series." onShowAll={clearFilters} />
        ) : !hasGroups ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Series you add will appear here.</p>
          </div>
        ) : visibleEntries.length === 0 && visibleWishes.length === 0 ? (
          <EmptyState title="No series found" message="Try another series title or author."
            action={<Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>} />
        ) : (
          <>
            {visibleEntries.length > 0 && <LibrarySeriesEntries entries={visibleEntries} onOpen={openSeries} />}
            {visibleWishes.length > 0 && (
              <section aria-labelledby={wishlistHeadingId} className={visibleEntries.length ? "mt-8 grid gap-4" : "grid gap-4"}>
                <h2 id={wishlistHeadingId} className="text-base font-semibold">In Wishlist</h2>
                <LibrarySeriesEntries entries={visibleWishes} onOpen={openSeries} label="Wishlist series" />
              </section>
            )}
          </>
        )}
      </div>}
    </CollectionSearch>
  );
}
