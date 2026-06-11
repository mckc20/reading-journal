import type { BookMetadataSource, PublicationDatePrecision } from "@/types";

export interface ParsedPublicationDate {
  date: string;
  precision: PublicationDatePrecision;
}

export interface BookLookupResult {
  title: string;
  authors: string[];
  totalPages?: number;
  genres?: string[];
  language?: string;
  format?: string;
  coverUrl?: string;
  publisher?: string;
  publicationDate?: string;
  publicationDatePrecision?: PublicationDatePrecision;
  description?: string;
  metadataSource: BookMetadataSource;
  metadataSourceUrl: string;
}

interface OpenLibraryBooksResponse {
  [bibkey: string]:
    | {
    title?: string;
        authors?: { name?: string }[];
        number_of_pages?: number;
        subjects?: { name?: string }[];
        languages?: { key?: string }[];
        publishers?: { name?: string }[];
        publish_date?: string;
        description?: string | { value?: string };
        excerpts?: { text?: string }[];
      }
    | undefined;
}

interface GoogleBooksVolume {
  items?: {
    selfLink?: string;
    volumeInfo: {
      title?: string;
      authors?: string[];
      pageCount?: number;
      categories?: string[];
      language?: string;
      publisher?: string;
      publishedDate?: string;
      description?: string;
    };
  }[];
}

interface BookcoverResponse {
  url?: string;
}

const languageMap: Record<string, string> = {
  en: "English",
  eng: "English",
  es: "Spanish",
  spa: "Spanish",
  de: "German",
  ger: "German",
  deu: "German",
};

const OPEN_LIBRARY_TIMEOUT_MS = 1500;

function uniqueClean(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function mapLanguage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return languageMap[value.toLowerCase()];
}

function apiUrl(url: string): string {
  return url;
}

function languageKeyToCode(key: string | undefined): string | undefined {
  const parts = key?.split("/").filter(Boolean);
  return parts?.[parts.length - 1];
}

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeMonthName(value: string): number | undefined {
  const normalized = value.trim().toLowerCase();
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const index = monthNames.findIndex((month) => month.startsWith(normalized.slice(0, 3)));
  return index >= 0 ? index + 1 : undefined;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parsePublicationDate(value: string | undefined): ParsedPublicationDate | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const isoMatch = trimmed.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2] ? Number(isoMatch[2]) : undefined;
    const day = isoMatch[3] ? Number(isoMatch[3]) : undefined;
    if (month !== undefined && (month < 1 || month > 12)) return undefined;
    if (day !== undefined && (day < 1 || day > 31)) return undefined;

    return {
      date: `${year}-${pad2(month ?? 1)}-${pad2(day ?? 1)}`,
      precision: day ? "day" : month ? "month" : "year",
    };
  }

  const monthYearMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = normalizeMonthName(monthYearMatch[1]);
    if (!month) return undefined;
    return {
      date: `${monthYearMatch[2]}-${pad2(month)}-01`,
      precision: "month",
    };
  }

  const dayMonthYearMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayMonthYearMatch) {
    const day = Number(dayMonthYearMatch[1]);
    const month = normalizeMonthName(dayMonthYearMatch[2]);
    if (!month || day < 1 || day > 31) return undefined;
    return {
      date: `${dayMonthYearMatch[3]}-${pad2(month)}-${pad2(day)}`,
      precision: "day",
    };
  }

  const yearMatch = trimmed.match(/\b(\d{4})\b/);
  if (yearMatch) {
    return {
      date: `${yearMatch[1]}-01-01`,
      precision: "year",
    };
  }

  return undefined;
}

function getOpenLibraryDescription(
  description: string | { value?: string } | undefined,
  excerpts: { text?: string }[] | undefined,
): string | undefined {
  if (typeof description === "string") return cleanText(description);
  return cleanText(description?.value) ?? cleanText(excerpts?.[0]?.text);
}

function withTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => globalThis.clearTimeout(timeout),
  };
}

async function fetchOpenLibraryMetadata(isbn: string): Promise<BookLookupResult | null> {
  const bibkey = `ISBN:${isbn}`;
  const url = apiUrl(
    `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(bibkey)}&format=json&jscmd=data`,
  );
  const { signal, cleanup } = withTimeoutSignal(OPEN_LIBRARY_TIMEOUT_MS);

  const res = await fetch(url, { signal }).finally(cleanup);
  if (!res.ok) return null;

  const data: OpenLibraryBooksResponse = await res.json();
  const book = data[bibkey];
  if (!book) return null;

  const authors = uniqueClean(book.authors?.map((author) => author.name ?? ""));
  const genres = uniqueClean(book.subjects?.map((subject) => subject.name ?? "")).slice(0, 12);
  const language = book.languages
    ?.map((item) => mapLanguage(languageKeyToCode(item.key)))
    .find(Boolean);
  const publisher = uniqueClean(book.publishers?.map((publisherItem) => publisherItem.name ?? ""))[0];
  const publicationDate = parsePublicationDate(book.publish_date);

  return {
    title: book.title?.trim() || "Untitled",
    authors: authors.length > 0 ? authors : ["Unknown"],
    totalPages: book.number_of_pages,
    genres: genres.length > 0 ? genres : undefined,
    language,
    publisher,
    publicationDate: publicationDate?.date,
    publicationDatePrecision: publicationDate?.precision,
    description: getOpenLibraryDescription(book.description, book.excerpts),
    metadataSource: "open_library",
    metadataSourceUrl: url,
  };
}

async function fetchGoogleBooksMetadata(isbn: string): Promise<BookLookupResult | null> {
  const url = apiUrl(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
  const res = await fetch(url);
  if (!res.ok) return null;

  const data: GoogleBooksVolume = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  const info = item.volumeInfo;
  const authors = uniqueClean(info.authors);
  const genres = uniqueClean(info.categories);
  const publicationDate = parsePublicationDate(info.publishedDate);

  return {
    title: info.title?.trim() || "Untitled",
    authors: authors.length > 0 ? authors : ["Unknown"],
    totalPages: info.pageCount,
    genres: genres.length > 0 ? genres : undefined,
    language: mapLanguage(info.language),
    publisher: cleanText(info.publisher),
    publicationDate: publicationDate?.date,
    publicationDatePrecision: publicationDate?.precision,
    description: cleanText(info.description),
    metadataSource: "google_books",
    metadataSourceUrl: item.selfLink ?? url,
  };
}

async function fetchBookcoverUrl(isbn: string): Promise<string | null> {
  const res = await fetch(
    `https://bookcover.longitood.com/bookcover?isbn=${encodeURIComponent(isbn)}`,
  );
  if (!res.ok) return null;
  const data: BookcoverResponse = await res.json();
  return data.url ?? null;
}

export async function fetchBookMetadataByISBN(
  isbn: string,
): Promise<Omit<BookLookupResult, "coverUrl"> | null> {
  return (
    (await fetchOpenLibraryMetadata(isbn).catch(() => null)) ??
    (await fetchGoogleBooksMetadata(isbn))
  );
}

export async function fetchBookByISBN(
  isbn: string,
): Promise<BookLookupResult | null> {
  const [metadata, coverUrl] = await Promise.all([
    fetchBookMetadataByISBN(isbn),
    fetchBookcoverUrl(isbn).catch(() => null),
  ]);

  if (!metadata) return null;

  return {
    ...metadata,
    coverUrl: coverUrl ?? undefined,
  };
}
