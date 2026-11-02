import type { Book } from "../types";

export const librarySorts = ["date-added", "title", "author", "last-read", "date-finished", "rating", "page-count"] as const;
export type LibrarySort = typeof librarySorts[number];
export type SortDirection = "asc" | "desc";
export const librarySortLabels: Record<LibrarySort, string> = {
  "date-added": "Date Added", title: "Title", author: "Author", "last-read": "Last Read",
  "date-finished": "Date Finished", rating: "Rating", "page-count": "Page Count",
};

export function normalizeLibrarySort(value: string | null): LibrarySort {
  // Keep previously shared rating links working after merging the two choices.
  if (value === "highest-rated" || value === "lowest-rated") return "rating";
  return librarySorts.includes(value as LibrarySort) ? value as LibrarySort : "title";
}

export function defaultSortDirection(sort: LibrarySort): SortDirection {
  return sort === "title" || sort === "author" || sort === "page-count" ? "asc" : "desc";
}

export function sortDirectionLabel(sort: LibrarySort, direction: SortDirection): string {
  if (sort === "title" || sort === "author") return direction === "asc" ? "A → Z" : "Z → A";
  if (sort === "page-count" || sort === "rating") return direction === "asc" ? "Low → High" : "High → Low";
  return direction === "asc" ? "Oldest → Newest" : "Newest → Oldest";
}

function dateValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function sortLibraryBooks(
  books: Book[],
  sort: LibrarySort,
  latestReadTimesByBook = new Map<string, number>(),
  direction = defaultSortDirection(sort),
): Book[] {
  function value(book: Book): string | number | null {
    switch (sort) {
      case "title": return book.title;
      case "author": return book.authors[0]?.trim() || null;
      case "date-added": return dateValue(book.created_at);
      case "last-read": return latestReadTimesByBook.get(book.id) ?? dateValue(book.date_finished);
      case "date-finished": return dateValue(book.date_finished);
      case "rating": return book.rating ?? null;
      case "page-count": return book.total_pages && book.total_pages > 0 ? book.total_pages : null;
    }
  }
  const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return [...books].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    // Missing values stay last in either direction; only the primary value reverses.
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    const difference = av === null || bv === null ? 0
      : typeof av === "string" && typeof bv === "string" ? compareText(av, bv) : Number(av) - Number(bv);
    return difference * (direction === "asc" ? 1 : -1) || compareText(a.title, b.title);
  });
}
