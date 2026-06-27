import type { AuthorSummary } from "@/lib/authorShelf";

const RECENTLY_READ_WINDOW_MS = 5 * 7 * 24 * 60 * 60 * 1000;

export type AuthorSort = "name" | "recently-added" | "latest-read" | "top-rated" | "most-read";

export type AuthorFilterKey = "genre" | "language" | "nationality";

export type AuthorFilters = Record<AuthorFilterKey, string[]>;

export function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function uniqueSortedValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );
}

export function getLatestReadAt(author: AuthorSummary): number {
  if (!author.latestReadDate) return 0;
  const time = new Date(author.latestReadDate).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function getNewestCreatedAt(author: AuthorSummary): number {
  const time = new Date(author.created_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function getLatestFinishedAt(author: AuthorSummary): number {
  return author.books.reduce((latestFinishedAt, book) => {
    if (book.status !== "Finished" || !book.date_finished) return latestFinishedAt;
    const finishedAt = new Date(book.date_finished).getTime();
    return Number.isFinite(finishedAt) ? Math.max(latestFinishedAt, finishedAt) : latestFinishedAt;
  }, 0);
}

export function wasReadInRecentWindow(author: AuthorSummary, now = Date.now()): boolean {
  const latestFinishedAt = getLatestFinishedAt(author);
  return latestFinishedAt <= now && latestFinishedAt >= now - RECENTLY_READ_WINDOW_MS;
}

export function compareAuthorsByName(a: AuthorSummary, b: AuthorSummary): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
}

export function sortAuthorsByName(authors: AuthorSummary[]): AuthorSummary[] {
  return [...authors].sort(compareAuthorsByName);
}

export function sortAuthorsForTopShelf(authors: AuthorSummary[]): AuthorSummary[] {
  return [...authors].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if ((b.averageRating ?? -1) !== (a.averageRating ?? -1)) {
      return (b.averageRating ?? -1) - (a.averageRating ?? -1);
    }
    if (a.bookCount !== b.bookCount) return b.bookCount - a.bookCount;
    return compareAuthorsByName(a, b);
  });
}

export function sortAuthorsByRecentlyRead(authors: AuthorSummary[]): AuthorSummary[] {
  return [...authors].sort((a, b) => {
    const latestReadDiff = getLatestReadAt(b) - getLatestReadAt(a);
    if (latestReadDiff !== 0) return latestReadDiff;
    return compareAuthorsByName(a, b);
  });
}

export function sortAuthorsByMostRead(authors: AuthorSummary[]): AuthorSummary[] {
  return [...authors].sort((a, b) => {
    if (b.statusCounts.read !== a.statusCounts.read) return b.statusCounts.read - a.statusCounts.read;
    if ((b.averageRating ?? -1) !== (a.averageRating ?? -1)) {
      return (b.averageRating ?? -1) - (a.averageRating ?? -1);
    }
    return compareAuthorsByName(a, b);
  });
}

export function getAuthorFilters(searchParams: URLSearchParams): AuthorFilters {
  const getValues = (key: AuthorFilterKey) =>
    Array.from(new Set(searchParams.getAll(key).map((value) => value.trim()).filter(Boolean)));

  return {
    genre: getValues("genre"),
    language: getValues("language"),
    nationality: getValues("nationality"),
  };
}

export function hasActiveAuthorFilters(filters: AuthorFilters): boolean {
  return filters.genre.length > 0 || filters.language.length > 0 || filters.nationality.length > 0;
}

export function matchesAuthorFilters(author: AuthorSummary, filters: AuthorFilters): boolean {
  if (
    filters.genre.length > 0 &&
    !author.books.some((book) => (book.genres ?? []).some((genre) => filters.genre.includes(genre)))
  ) {
    return false;
  }
  if (filters.language.length > 0 && !author.books.some((book) => book.language && filters.language.includes(book.language))) {
    return false;
  }
  if (filters.nationality.length > 0 && !filters.nationality.includes(author.nationality ?? "")) {
    return false;
  }
  return true;
}

export function filterAuthors(authors: AuthorSummary[], filters: AuthorFilters): AuthorSummary[] {
  return authors.filter((author) => matchesAuthorFilters(author, filters));
}
