import type { Book, BookStatus, Series } from "@/types";

export type LibraryFilterKey =
  | "status"
  | "genre"
  | "rating"
  | "year"
  | "publicationYear"
  | "format"
  | "language"
  | "source"
  | "series"
  | "author"
  | "catalogue";

export type LibraryFilters = Record<LibraryFilterKey, string[]>;

export type LibraryFilterOptions = Record<LibraryFilterKey, string[]>;

export type ActiveFilterChip = {
  keys: LibraryFilterKey[];
  label: string;
};

const filterableBookStatuses: BookStatus[] = [
  "To Read",
  "Up Next",
  "Reading",
  "Paused",
  "Finished",
  "DNF",
];

export const filterKeys: LibraryFilterKey[] = [
  "status",
  "genre",
  "rating",
  "year",
  "publicationYear",
  "format",
  "language",
  "source",
  "series",
  "author",
  "catalogue",
];

export const filterLabels: Record<LibraryFilterKey, string> = {
  status: "Status",
  genre: "Genre",
  rating: "Rating",
  year: "Year Read",
  publicationYear: "Publication Year",
  format: "Format",
  language: "Language",
  source: "Source",
  series: "Series",
  author: "Author",
  catalogue: "Catalogue",
};

const statusFilterLabels: Record<BookStatus, string> = {
  Wishlist: "Wishlist",
  "To Read": "To Read",
  "Up Next": "Up Next",
  Reading: "Currently Reading",
  Paused: "Paused",
  Finished: "Finished",
  DNF: "DNF",
};

const statusFilterOptions = filterableBookStatuses.map((status) => statusFilterLabels[status]);

export type LibraryFilterBook = Pick<Book, "authors" | "status" | "genres" | "rating" | "date_finished" | "date_started" | "created_at" | "publication_date" | "format" | "language" | "source" | "series_id" | "metadata_source">;

export function getCatalogueName(source: Book["metadata_source"]) {
  if (source === "open_library") return "Open Library";
  if (source === "google_books") return "Google Books";
}

function uniqueSortedValues(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
}

function getBookFilterDate(book: LibraryFilterBook): string | undefined {
  return book.date_finished ?? book.date_started ?? book.created_at;
}

function getBookFilterDateParts(book: LibraryFilterBook): { year?: string; month?: string } {
  const value = getBookFilterDate(book);
  if (!value) return {};

  const [datePart] = value.split("T");
  const [year, month] = datePart.split("-");

  if (!year || !month) return {};
  return { year, month };
}

export function getPublicationYear(book: LibraryFilterBook): string | undefined {
  const [year] = (book.publication_date ?? "").split("-");
  return year && /^\d{4}$/.test(year) ? year : undefined;
}

function getFilterValues(searchParams: URLSearchParams, key: LibraryFilterKey): string[] {
  return Array.from(
    new Set(searchParams.getAll(key).map((value) => value.trim()).filter(value => value && (key !== "rating" || value !== "Favorite"))),
  );
}

export function getLibraryFilters(searchParams: URLSearchParams): LibraryFilters {
  return {
    status: getFilterValues(searchParams, "status"),
    genre: getFilterValues(searchParams, "genre"),
    rating: getFilterValues(searchParams, "rating"),
    year: getFilterValues(searchParams, "year"),
    publicationYear: getFilterValues(searchParams, "publicationYear"),
    format: getFilterValues(searchParams, "format"),
    language: getFilterValues(searchParams, "language"),
    source: getFilterValues(searchParams, "source"),
    series: getFilterValues(searchParams, "series"),
    author: getFilterValues(searchParams, "author"),
    catalogue: getFilterValues(searchParams, "catalogue"),
  };
}

function hasActiveLibraryFilters(filters: LibraryFilters): boolean {
  return filterKeys.some((key) => filters[key].length > 0);
}

export function buildLibraryFilterOptions(books: LibraryFilterBook[], series: Series[]): LibraryFilterOptions {
  const years = new Set<string>();
  const publicationYears = new Set<string>();
  const seriesById = new Map(series.map((item) => [item.id, item.name]));

  books.forEach((book) => {
    const { year } = getBookFilterDateParts(book);
    if (year) years.add(year);

    const publicationYear = getPublicationYear(book);
    if (publicationYear) publicationYears.add(publicationYear);
  });

  return {
    status: books.some(book => book.status === "Wishlist") ? ["Wishlist", ...statusFilterOptions] : statusFilterOptions,
    genre: uniqueSortedValues(books.flatMap((book) => book.genres ?? [])),
    rating: uniqueSortedValues(books.map((book) => book.rating?.toString())),
    year: Array.from(years).sort((a, b) => Number(b) - Number(a)),
    publicationYear: Array.from(publicationYears).sort((a, b) => Number(b) - Number(a)),
    format: uniqueSortedValues(books.map((book) => book.format)),
    language: uniqueSortedValues(books.map((book) => book.language)),
    source: uniqueSortedValues(books.map((book) => book.source)),
    series: uniqueSortedValues(books.map((book) => (book.series_id ? seriesById.get(book.series_id) : null))),
    author: uniqueSortedValues(books.flatMap((book) => book.authors)),
    catalogue: uniqueSortedValues(books.map(book => getCatalogueName(book.metadata_source))),
  };
}

function matchesAnyFilterValue(values: string[], matches: (value: string) => boolean): boolean {
  return values.length === 0 || values.some(matches);
}

function bookMatchesLibraryFilters(book: LibraryFilterBook, filters: LibraryFilters, series: Series[]): boolean {
  if (!matchesAnyFilterValue(filters.status, filter => statusFilterLabels[book.status] === filter || book.status === filter)) return false;

  if (!matchesAnyFilterValue(filters.genre, (filter) => (book.genres ?? []).includes(filter))) return false;

  if (!matchesAnyFilterValue(filters.rating, (filter) => {
    const rating = Number(filter);
    return Number.isFinite(rating) && book.rating === rating;
  })) return false;

  if (!matchesAnyFilterValue(filters.publicationYear, (filter) => getPublicationYear(book) === filter)) return false;
  if (!matchesAnyFilterValue(filters.format, (filter) => book.format === filter)) return false;
  if (!matchesAnyFilterValue(filters.language, (filter) => book.language === filter)) return false;
  if (!matchesAnyFilterValue(filters.source, (filter) => book.source === filter)) return false;
  if (!matchesAnyFilterValue(filters.series, (filter) => getSeriesName(book, series) === filter)) return false;
  if (!matchesAnyFilterValue(filters.author, (filter) => book.authors.includes(filter))) return false;

  if (!matchesAnyFilterValue(filters.catalogue, value => getCatalogueName(book.metadata_source) === value)) return false;

  if (filters.year.length > 0) {
    const { year } = getBookFilterDateParts(book);
    if (!year || !filters.year.includes(year)) return false;
  }

  return true;
}

export function applyLibraryFilters<T extends LibraryFilterBook>(books: T[], filters: LibraryFilters, series: Series[]): T[] {
  if (!hasActiveLibraryFilters(filters)) return books;
  return books.filter((book) => bookMatchesLibraryFilters(book, filters, series));
}

export function buildActiveFilterChips(filters: LibraryFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  filterKeys.forEach((key) => {
    const values = filters[key];
    if (values.length === 0) return;

    chips.push({
      keys: [key],
      label: `${filterLabels[key]}: ${values.join(", ")}`,
    });
  });

  return chips;
}

function getSeriesName(book: LibraryFilterBook, series: Series[]): string {
  if (!book.series_id) return "";
  return series.find((item) => item.id === book.series_id)?.name ?? "";
}
