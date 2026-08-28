import type { VercelRequest } from "@vercel/node";

export const API_BOOK_STATUSES = ["To Read", "Up Next", "Reading", "Paused", "Finished", "DNF"] as const;

export type ApiBookStatus = (typeof API_BOOK_STATUSES)[number];

export type BookListOptions = {
  status: ApiBookStatus | null;
  limit: number;
};

type ApiBookAuthorLink = {
  position: number;
  // PostgREST returns a single object for this many-to-one relation at runtime,
  // while Supabase's generic TypeScript type models it as an array.
  authors: { name: string } | { name: string }[] | null;
};

type ApiBookRow = {
  id: string;
  title: string;
  status: ApiBookStatus;
  current_page: number | null;
  total_pages: number | null;
  book_authors: ApiBookAuthorLink[] | null;
};

export type ApiBook = Omit<ApiBookRow, "book_authors"> & {
  authors: string[];
};

// Authors live in their own table, linked to books through book_authors.
// Keep that database detail out of the public API response.
export function toApiBook(book: ApiBookRow): ApiBook {
  const authors = (book.book_authors ?? [])
    .sort((first, second) => first.position - second.position)
    .flatMap((link) => {
      const author = Array.isArray(link.authors) ? link.authors[0] : link.authors;
      return author?.name ? [author.name] : [];
    });

  const { book_authors: _bookAuthors, ...bookFields } = book;
  return { ...bookFields, authors };
}

const DEFAULT_BOOK_LIMIT = 50;
const MAX_BOOK_LIMIT = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getSingleQueryValue(request: VercelRequest, name: string): string | null {
  const value = request.query[name];
  if (Array.isArray(value)) throw new Error(`${name} must be supplied only once.`);
  return value ?? null;
}

export function parseBookListOptions(request: VercelRequest): BookListOptions {
  const rawStatus = getSingleQueryValue(request, "status");
  const rawLimit = getSingleQueryValue(request, "limit");

  if (rawStatus !== null && !API_BOOK_STATUSES.includes(rawStatus as ApiBookStatus)) {
    throw new Error(`status must be one of: ${API_BOOK_STATUSES.join(", ")}.`);
  }

  if (rawLimit === null) {
    return { status: (rawStatus as ApiBookStatus | null) ?? null, limit: DEFAULT_BOOK_LIMIT };
  }

  if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) {
    throw new Error("limit must be a positive whole number.");
  }

  return {
    status: (rawStatus as ApiBookStatus | null) ?? null,
    limit: Math.min(Number(rawLimit), MAX_BOOK_LIMIT),
  };
}

export function parseBookSearchQuery(request: VercelRequest): string {
  const query = getSingleQueryValue(request, "q")?.trim();
  if (!query) throw new Error("q is required.");

  return query;
}

export function getBookId(request: VercelRequest): string | null {
  const bookId = getSingleQueryValue(request, "id");
  return bookId && UUID_PATTERN.test(bookId) ? bookId : null;
}

export function getProgressPercent(currentPage: number | null, totalPages: number | null): number | null {
  if (!totalPages || totalPages <= 0) return null;

  return Math.min(100, Math.max(0, Math.round(((currentPage ?? 0) / totalPages) * 100)));
}
