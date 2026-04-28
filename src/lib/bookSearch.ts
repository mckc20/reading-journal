import type { Book, Series } from "@/types";

export type BookSearchPropertyKey =
  | "title"
  | "authors"
  | "genres"
  | "status"
  | "rating"
  | "favorite"
  | "pagesProgress"
  | "dates"
  | "language"
  | "belongsTo"
  | "format"
  | "isbn"
  | "series"
  | "volume";

export type BookSearchSourceKey = BookSearchPropertyKey | (string & {});

export interface BookSearchProperty {
  key: BookSearchSourceKey;
  label: string;
}

export interface BookSearchSource {
  key: BookSearchSourceKey;
  label: string;
  getValues: (book: Book, context: BookSearchContext) => string[];
}

export interface BookSearchContext {
  seriesById: Map<string, Series>;
}

export interface BookSearchOptions {
  series?: Series[];
  selectedProperties?: BookSearchSourceKey[];
  additionalSources?: BookSearchSource[];
}

export interface BookSearchMatch {
  book: Book;
  property: BookSearchProperty;
  values: string[];
}

export interface BookSearchSection {
  property: BookSearchProperty;
  matches: BookSearchMatch[];
}

export const BOOK_SEARCH_PROPERTIES: Array<{
  key: BookSearchPropertyKey;
  label: string;
}> = [
  { key: "title", label: "Title" },
  { key: "authors", label: "Authors" },
  { key: "genres", label: "Genres" },
  { key: "status", label: "Status" },
  { key: "series", label: "Series" },
  { key: "volume", label: "Volume" },
  { key: "language", label: "Language" },
  { key: "format", label: "Format" },
  { key: "belongsTo", label: "Belongs To" },
  { key: "rating", label: "Rating" },
  { key: "favorite", label: "Favorite" },
  { key: "dates", label: "Dates" },
  { key: "pagesProgress", label: "Pages / Progress" },
  { key: "isbn", label: "ISBN" },
];

const BASE_SOURCES: BookSearchSource[] = [
  {
    key: "title",
    label: "Title",
    getValues: (book) => [book.title],
  },
  {
    key: "authors",
    label: "Authors",
    getValues: (book) => book.authors,
  },
  {
    key: "genres",
    label: "Genres",
    getValues: (book) => book.genres ?? [],
  },
  {
    key: "status",
    label: "Status",
    getValues: (book) => [book.status],
  },
  {
    key: "series",
    label: "Series",
    getValues: (book, context) => {
      if (!book.series_id) return [];
      const series = context.seriesById.get(book.series_id);
      return series ? [series.name] : [];
    },
  },
  {
    key: "volume",
    label: "Volume",
    getValues: (book) =>
      typeof book.volume_number === "number"
        ? [`${book.volume_number}`, `Volume ${book.volume_number}`]
        : [],
  },
  {
    key: "language",
    label: "Language",
    getValues: (book) => (book.language ? [book.language] : []),
  },
  {
    key: "format",
    label: "Format",
    getValues: (book) => (book.format ? [book.format] : []),
  },
  {
    key: "belongsTo",
    label: "Belongs To",
    getValues: (book) => (book.belongs_to ? [book.belongs_to] : []),
  },
  {
    key: "rating",
    label: "Rating",
    getValues: (book) =>
      typeof book.rating === "number"
        ? [`${book.rating}`, `${book.rating} stars`, `${book.rating}/5`]
        : [],
  },
  {
    key: "favorite",
    label: "Favorite",
    getValues: (book) => (book.is_favorite ? ["Is favorite", "Favorite"] : []),
  },
  {
    key: "dates",
    label: "Dates",
    getValues: (book) => formatDateValues(book),
  },
  {
    key: "pagesProgress",
    label: "Pages / Progress",
    getValues: (book) => formatProgressValues(book),
  },
  {
    key: "isbn",
    label: "ISBN",
    getValues: (book) => (book.isbn ? [book.isbn] : []),
  },
];

export function searchBooks(
  books: Book[],
  query: string,
  options: BookSearchOptions = {}
): BookSearchSection[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const selected = new Set(
    options.selectedProperties ?? BOOK_SEARCH_PROPERTIES.map((property) => property.key)
  );
  if (selected.size === 0) return [];

  const context: BookSearchContext = {
    seriesById: new Map((options.series ?? []).map((series) => [series.id, series])),
  };

  const sources = [...BASE_SOURCES, ...(options.additionalSources ?? [])].filter((source) =>
    selected.has(source.key)
  );

  return sources
    .map((source) => {
      const matches = books
        .map((book): BookSearchMatch | null => {
          const values = unique(source.getValues(book, context).filter(Boolean));
          const matchedValues = values.filter((value) => matchesQuery(value, normalizedQuery));
          if (matchedValues.length === 0) return null;

          return {
            book,
            property: { key: source.key, label: source.label },
            values: matchedValues,
          };
        })
        .filter((match): match is BookSearchMatch => match !== null);

      return {
        property: { key: source.key, label: source.label },
        matches,
      };
    })
    .filter((section) => section.matches.length > 0);
}

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(value: string, normalizedQuery: string): boolean {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return false;
  if (normalizedValue.includes(normalizedQuery)) return true;

  const queryTokens = tokenize(normalizedQuery);
  const valueTokens = tokenize(normalizedValue);

  return queryTokens.every((queryToken) =>
    valueTokens.some(
      (valueToken) =>
        valueToken.includes(queryToken) ||
        isFuzzyTokenMatch(valueToken, queryToken)
    )
  );
}

function tokenize(value: string): string[] {
  return value.split(/[^a-z0-9]+/).filter(Boolean);
}

function isFuzzyTokenMatch(valueToken: string, queryToken: string): boolean {
  if (queryToken.length < 4 || valueToken.length < 4) return false;
  const maxDistance = queryToken.length >= 7 ? 2 : 1;
  return levenshteinDistance(valueToken, queryToken) <= maxDistance;
}

function levenshteinDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function formatProgressValues(book: Book): string[] {
  const values: string[] = [];
  const currentPage = book.current_page;
  const totalPages = book.total_pages;

  if (typeof currentPage === "number") {
    values.push(`${currentPage}`, `Page ${currentPage}`);
  }

  if (typeof totalPages === "number") {
    values.push(`${totalPages}`, `${totalPages} pages`);
  }

  if (
    typeof currentPage === "number" &&
    typeof totalPages === "number" &&
    totalPages > 0
  ) {
    const percent = Math.round((currentPage / totalPages) * 100);
    values.push(`${currentPage} / ${totalPages}`, `${percent}%`);
  }

  return values;
}

function formatDateValues(book: Book): string[] {
  const values: string[] = [];
  if (book.date_started) {
    values.push(book.date_started, `Started ${formatDateForDisplay(book.date_started)}`);
  }
  if (book.date_finished) {
    values.push(book.date_finished, `Finished ${formatDateForDisplay(book.date_finished)}`);
  }
  return values;
}

function formatDateForDisplay(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
