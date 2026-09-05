import type { VercelRequest } from "@vercel/node";

export const API_BOOK_STATUSES = ["To Read", "Up Next", "Reading", "Paused", "Finished", "DNF"] as const;

export type ApiBookStatus = (typeof API_BOOK_STATUSES)[number];

export const API_BOOK_FIELDS = "id, title, status, current_page, total_pages, book_authors(position, authors(name))";

export type BookUpdatePayload = {
  status?: ApiBookStatus;
  current_page?: number | null;
  rating?: number | null;
  date_started?: string | null;
  date_finished?: string | null;
};

export type ReadingLogPayload = {
  current_page: number;
  reading_time_minutes: number | null;
  logged_at?: string;
};

export type ReadingLogBook = {
  status: ApiBookStatus;
  current_page: number | null;
  total_pages: number | null;
  date_started: string | null;
  date_finished: string | null;
};

export type ReadingLogBookUpdate = {
  current_page: number;
  status?: ApiBookStatus;
  date_started?: string;
  date_finished?: string;
};

export const API_JOURNAL_LABELS = ["note", "review", "quote"] as const;

export type ApiJournalLabel = (typeof API_JOURNAL_LABELS)[number];

export type BookJournalPayload = {
  label: ApiJournalLabel;
  content: string;
  quote_speaker: string | null;
  page_start: number | null;
  tags: string[] | null;
};

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
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function parseDate(value: unknown, field: "date_started" | "date_finished"): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error(`${field} must use the YYYY-MM-DD format or be null.`);
  }
  return value;
}

// Keep the public API deliberately small: callers can update reading state, but
// cannot alter ownership, creation data, or other book metadata.
export function parseBookUpdatePayload(body: unknown): BookUpdatePayload {
  if (!isRecord(body)) throw new Error("Request body must be a JSON object.");

  const payload: BookUpdatePayload = {};

  if (hasOwn(body, "status")) {
    if (typeof body.status !== "string" || !API_BOOK_STATUSES.includes(body.status as ApiBookStatus)) {
      throw new Error(`status must be one of: ${API_BOOK_STATUSES.join(", ")}.`);
    }
    payload.status = body.status as ApiBookStatus;
  }

  if (hasOwn(body, "current_page")) {
    if (body.current_page !== null && (!Number.isInteger(body.current_page) || (body.current_page as number) < 0)) {
      throw new Error("current_page must be a non-negative whole number or null.");
    }
    payload.current_page = body.current_page as number | null;
  }

  if (hasOwn(body, "rating")) {
    if (body.rating !== null && (!Number.isInteger(body.rating) || (body.rating as number) < 1 || (body.rating as number) > 5)) {
      throw new Error("rating must be a whole number from 1 to 5 or null.");
    }
    payload.rating = body.rating as number | null;
  }

  if (hasOwn(body, "date_started")) payload.date_started = parseDate(body.date_started, "date_started");
  if (hasOwn(body, "date_finished")) payload.date_finished = parseDate(body.date_finished, "date_finished");

  return payload;
}

export function addAutomaticStatusDates(
  payload: BookUpdatePayload,
  existingDates: { date_started: string | null; date_finished: string | null },
  today: string,
): BookUpdatePayload {
  const update = { ...payload };

  if (update.status === "Reading" && !("date_started" in update) && !existingDates.date_started) {
    update.date_started = today;
  }
  if (update.status === "Finished" && !("date_finished" in update) && !existingDates.date_finished) {
    update.date_finished = today;
  }

  return update;
}

export function parseReadingLogPayload(body: unknown): ReadingLogPayload {
  if (!isRecord(body)) throw new Error("Request body must be a JSON object.");
  if (!hasOwn(body, "current_page") || !Number.isInteger(body.current_page) || (body.current_page as number) < 0) {
    throw new Error("current_page is required and must be a non-negative whole number.");
  }

  if (
    hasOwn(body, "reading_time_minutes") &&
    (!Number.isInteger(body.reading_time_minutes) || (body.reading_time_minutes as number) < 0)
  ) {
    throw new Error("reading_time_minutes must be a non-negative whole number.");
  }

  if (hasOwn(body, "logged_at")) {
    if (typeof body.logged_at !== "string" || !body.logged_at.includes("T") || Number.isNaN(Date.parse(body.logged_at))) {
      throw new Error("logged_at must be a valid ISO timestamp.");
    }
  }

  return {
    current_page: body.current_page as number,
    reading_time_minutes: hasOwn(body, "reading_time_minutes") ? (body.reading_time_minutes as number) : null,
    ...(hasOwn(body, "logged_at") ? { logged_at: body.logged_at as string } : {}),
  };
}

export function getReadingLogBookUpdate(
  book: ReadingLogBook,
  requestedPage: number,
  today: string,
): ReadingLogBookUpdate {
  const currentPage = Math.max(book.current_page ?? 0, requestedPage);
  const update: ReadingLogBookUpdate = { current_page: currentPage };
  const startsReading = book.status !== "Reading" && book.status !== "Finished";
  const hasReachedEnd = typeof book.total_pages === "number" && book.total_pages > 0 && currentPage >= book.total_pages;

  if (startsReading) {
    update.status = "Reading";
    if (!book.date_started) update.date_started = today;
  }
  if (hasReachedEnd) {
    update.status = "Finished";
    if (!book.date_finished) update.date_finished = today;
  }

  return update;
}

export function parseBookJournalPayload(body: unknown): BookJournalPayload {
  if (!isRecord(body)) throw new Error("Request body must be a JSON object.");
  if (typeof body.label !== "string" || !API_JOURNAL_LABELS.includes(body.label as ApiJournalLabel)) {
    throw new Error(`label must be one of: ${API_JOURNAL_LABELS.join(", ")}.`);
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    throw new Error("content is required.");
  }

  if (hasOwn(body, "quote_speaker") && body.quote_speaker !== null && typeof body.quote_speaker !== "string") {
    throw new Error("quote_speaker must be a string or null.");
  }
  if (
    hasOwn(body, "page_start") &&
    body.page_start !== null &&
    (!Number.isInteger(body.page_start) || (body.page_start as number) < 1)
  ) {
    throw new Error("page_start must be a whole page number greater than 0 or null.");
  }
  if (
    hasOwn(body, "tags") &&
    body.tags !== null &&
    (!Array.isArray(body.tags) || body.tags.some((tag) => typeof tag !== "string"))
  ) {
    throw new Error("tags must be an array of strings or null.");
  }

  const label = body.label as ApiJournalLabel;
  const tags = Array.isArray(body.tags)
    ? Array.from(new Set(body.tags.map((tag) => tag.trim()).filter(Boolean)))
    : [];

  return {
    label,
    content: body.content.trim(),
    quote_speaker: label === "quote" ? (typeof body.quote_speaker === "string" ? body.quote_speaker.trim() || null : null) : null,
    page_start: typeof body.page_start === "number" ? body.page_start : null,
    tags: tags.length > 0 ? tags : null,
  };
}

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
