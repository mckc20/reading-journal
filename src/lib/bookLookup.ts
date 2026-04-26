import type { BookMetadataSource } from "@/types";

export interface BookLookupResult {
  title: string;
  authors: string[];
  totalPages?: number;
  genres?: string[];
  language?: string;
  format?: string;
  coverUrl?: string;
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

  return {
    title: book.title?.trim() || "Untitled",
    authors: authors.length > 0 ? authors : ["Unknown"],
    totalPages: book.number_of_pages,
    genres: genres.length > 0 ? genres : undefined,
    language,
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

  return {
    title: info.title?.trim() || "Untitled",
    authors: authors.length > 0 ? authors : ["Unknown"],
    totalPages: info.pageCount,
    genres: genres.length > 0 ? genres : undefined,
    language: mapLanguage(info.language),
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
