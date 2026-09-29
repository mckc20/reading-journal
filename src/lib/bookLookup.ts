import { parsePublicationDate } from "@/lib/publicationDate";
import type { BookMetadataSource } from "@/types";

export { parsePublicationDate } from "@/lib/publicationDate";

export interface BookLookupResult {
  title: string;
  authors: string[];
  totalPages?: number;
  genres?: string[];
  language?: string;
  format?: string;
  coverUrl?: string;
  publicationDate?: string;
  description?: string;
  metadataSource: BookMetadataSource;
  metadataSourceUrl: string;
}

export interface BookTitleSearchResult extends Omit<BookLookupResult, "format"> {
  id: string;
  isbn?: string;
}

interface OpenLibraryBooksResponse {
  [bibkey: string]:
    | {
    title?: string;
        authors?: { name?: string }[];
        number_of_pages?: number;
        subjects?: { name?: string }[];
        languages?: { key?: string }[];
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
      publishedDate?: string;
      description?: string;
      imageLinks?: {
        thumbnail?: string;
      };
      industryIdentifiers?: {
        type?: string;
        identifier?: string;
      }[];
    };
  }[];
}

interface OpenLibraryTitleSearchResponse {
  docs?: {
    key?: string;
    title?: string;
    author_name?: string[];
    number_of_pages_median?: number;
    subject?: string[];
    language?: string[];
    first_publish_year?: number;
    cover_i?: number;
    cover_edition_key?: string;
    isbn?: string[];
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

function safeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return undefined;
  }
}

function preferredIsbn(
  identifiers: { type?: string; identifier?: string }[] | undefined,
): string | undefined {
  const normalized = (identifiers ?? [])
    .map((identifier) => ({
      type: identifier.type?.toUpperCase(),
      value: cleanText(identifier.identifier),
    }))
    .filter((identifier): identifier is { type: string; value: string } => Boolean(identifier.value));

  return (
    normalized.find((identifier) => identifier.type === "ISBN_13")?.value ??
    normalized.find((identifier) => identifier.type === "ISBN_10")?.value
  );
}

function preferredIsbnValue(values: string[] | undefined): string | undefined {
  const normalized = (values ?? [])
    .map((value) => value.replace(/[-\s]/g, "").trim())
    .filter(Boolean);

  return (
    normalized.find((value) => /^\d{13}$/.test(value)) ??
    normalized.find((value) => /^\d{9}[\dXx]$/.test(value))
  );
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
  const publicationDate = parsePublicationDate(book.publish_date);

  return {
    title: book.title?.trim() || "Untitled",
    authors: authors.length > 0 ? authors : ["Unknown"],
    totalPages: book.number_of_pages,
    genres: genres.length > 0 ? genres : undefined,
    language,
    publicationDate: publicationDate?.date,
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
    publicationDate: publicationDate?.date,
    description: cleanText(info.description),
    metadataSource: "google_books",
    metadataSourceUrl: item.selfLink ?? url,
  };
}

async function searchGoogleBooksByTitle(title: string): Promise<BookTitleSearchResult[]> {
  const query = title.trim();
  if (!query) return [];

  const url = apiUrl(
    `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=10`,
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Books title search failed with status ${res.status}`);

  const data: GoogleBooksVolume = await res.json();
  return (data.items ?? []).slice(0, 10).map((item, index) => {
    const info = item.volumeInfo;
    const authors = uniqueClean(info.authors);
    const genres = uniqueClean(info.categories);
    const publicationDate = parsePublicationDate(info.publishedDate);
    const metadataSourceUrl = item.selfLink ?? url;

    return {
      id: item.selfLink ?? `${url}#${index}`,
      title: info.title?.trim() || "Untitled",
      authors: authors.length > 0 ? authors : ["Unknown"],
      totalPages: info.pageCount,
      genres: genres.length > 0 ? genres : undefined,
      language: mapLanguage(info.language),
      coverUrl: safeHttpsUrl(info.imageLinks?.thumbnail),
      publicationDate: publicationDate?.date,
      description: cleanText(info.description),
      isbn: preferredIsbn(info.industryIdentifiers),
      metadataSource: "google_books",
      metadataSourceUrl,
    };
  });
}

async function searchOpenLibraryByTitle(title: string): Promise<BookTitleSearchResult[]> {
  const query = title.trim();
  if (!query) return [];

  const fields = [
    "key",
    "title",
    "author_name",
    "number_of_pages_median",
    "subject",
    "language",
    "first_publish_year",
    "cover_i",
    "cover_edition_key",
    "isbn",
  ].join(",");
  const url = apiUrl(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=10&fields=${encodeURIComponent(fields)}`,
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Library title search failed with status ${res.status}`);

  const data: OpenLibraryTitleSearchResponse = await res.json();
  return (data.docs ?? []).slice(0, 10).map((book, index) => {
    const authors = uniqueClean(book.author_name);
    const genres = uniqueClean(book.subject).slice(0, 12);
    const publicationDate = book.first_publish_year
      ? parsePublicationDate(String(book.first_publish_year))
      : undefined;
    const metadataSourceUrl = url;
    const coverUrl = book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
      : book.cover_edition_key
        ? `https://covers.openlibrary.org/b/olid/${book.cover_edition_key}-M.jpg`
        : undefined;

    return {
      id: book.key ? `https://openlibrary.org${book.key}` : `${url}#${index}`,
      title: book.title?.trim() || "Untitled",
      authors: authors.length > 0 ? authors : ["Unknown"],
      totalPages: book.number_of_pages_median,
      genres: genres.length > 0 ? genres : undefined,
      language: book.language?.map((value) => mapLanguage(value)).find(Boolean),
      coverUrl: safeHttpsUrl(coverUrl),
      publicationDate: publicationDate?.date,
      isbn: preferredIsbnValue(book.isbn),
      metadataSource: "open_library",
      metadataSourceUrl,
    };
  });
}

export async function searchBooksByTitle(title: string): Promise<BookTitleSearchResult[]> {
  const query = title.trim();
  if (!query) return [];

  try {
    const googleResults = await searchGoogleBooksByTitle(query);
    if (googleResults.length > 0) return googleResults;
  } catch {
    // Open Library provides a resilient fallback when Google Books is unavailable or rate limited.
  }

  return searchOpenLibraryByTitle(query);
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
