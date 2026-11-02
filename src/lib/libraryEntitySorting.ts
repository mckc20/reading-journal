import type { SeriesBookGroup } from "./libraryShelves";
import type { AuthorSummary } from "./authorShelf";
import type { SortDirection } from "./librarySorting";

export const authorSortOptions = [
  { value: "name", label: "Name" },
  { value: "recently-added", label: "Date Added" },
  { value: "latest-read", label: "Last Read" },
  { value: "top-rated", label: "Rating" },
  { value: "most-read", label: "Books Read" },
] as const;
export type AuthorLibrarySort = typeof authorSortOptions[number]["value"];

export function authorSortDirectionLabel(sort: AuthorLibrarySort, direction: SortDirection): string {
  if (sort === "name") return direction === "asc" ? "A → Z" : "Z → A";
  if (sort === "top-rated" || sort === "most-read") return direction === "asc" ? "Low → High" : "High → Low";
  return direction === "asc" ? "Oldest → Newest" : "Newest → Oldest";
}

function dateValue(value: string | null | undefined): number | null {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

export function sortLibraryAuthors(authors: AuthorSummary[], sort: AuthorLibrarySort, direction: SortDirection): AuthorSummary[] {
  const value = (author: AuthorSummary): string | number | null => {
    switch (sort) {
      case "name": return author.name;
      case "recently-added": return dateValue(author.created_at);
      case "latest-read": return dateValue(author.latestReadDate);
      case "top-rated": return author.averageRating;
      case "most-read": return author.statusCounts.read;
    }
  };
  const byName = (a: AuthorSummary, b: AuthorSummary) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  return [...authors].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    const difference = av === null || bv === null ? 0
      : typeof av === "string" && typeof bv === "string" ? byName(a, b) : Number(av) - Number(bv);
    return difference * (direction === "asc" ? 1 : -1) || byName(a, b);
  });
}

export const seriesSortOptions = [
  { value: "name", label: "Name" },
  { value: "date-added", label: "Date Added" },
  { value: "last-read", label: "Last Read" },
  { value: "rating", label: "Rating" },
  { value: "book-count", label: "Book Count" },
] as const;
export type SeriesLibrarySort = typeof seriesSortOptions[number]["value"];

export function defaultSeriesSortDirection(sort: SeriesLibrarySort): SortDirection {
  return sort === "name" ? "asc" : "desc";
}

export function seriesSortDirectionLabel(sort: SeriesLibrarySort, direction: SortDirection): string {
  if (sort === "name") return direction === "asc" ? "A → Z" : "Z → A";
  if (sort === "book-count") return direction === "asc" ? "Low → High" : "High → Low";
  if (sort === "rating") return direction === "asc" ? "Low → High" : "High → Low";
  return direction === "asc" ? "Oldest → Newest" : "Newest → Oldest";
}

export function sortLibrarySeries(
  groups: SeriesBookGroup[],
  sort: SeriesLibrarySort,
  direction: SortDirection,
  context: {
    seriesCreatedAtById?: ReadonlyMap<string, string>;
    latestReadTimesByBook?: ReadonlyMap<string, number>;
  } = {},
): SeriesBookGroup[] {
  // Calculate each series value once, rather than scanning its books on every comparison.
  const values = new Map(groups.map((group): [string, string | number | null] => {
    let value: string | number | null = null;
    if (sort === "name") value = group.name;
    if (sort === "date-added") value = dateValue(context.seriesCreatedAtById?.get(group.seriesId) ?? null);
    if (sort === "book-count") value = group.books.length;
    if (sort === "rating") {
      const ratings = group.books.flatMap((book) => typeof book.rating === "number" && Number.isFinite(book.rating) ? [book.rating] : []);
      value = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
    }
    if (sort === "last-read") {
      for (const book of group.books) {
        const time = context.latestReadTimesByBook?.get(book.id) ?? dateValue(book.date_finished);
        if (time !== null && Number.isFinite(time)) value = Math.max(typeof value === "number" ? value : -Infinity, time);
      }
    }
    return [group.seriesId, value];
  }));
  const byName = (a: SeriesBookGroup, b: SeriesBookGroup) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  return [...groups].sort((a, b) => {
    const av = values.get(a.seriesId) ?? null;
    const bv = values.get(b.seriesId) ?? null;
    // Empty and unrated series stay at the bottom for dates and ratings in either direction.
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    const difference = av === null || bv === null ? 0
      : typeof av === "string" && typeof bv === "string" ? byName(a, b) : Number(av) - Number(bv);
    return difference * (direction === "asc" ? 1 : -1) || byName(a, b);
  });
}
