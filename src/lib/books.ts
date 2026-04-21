import { supabase } from "./supabase";
import type { Book, Series, ReadingLog } from "@/types";

type LegacyAuthorBookRow = Omit<Book, "authors"> & {
  authors?: string[] | null;
  author?: string | null;
  genre?: string | null;
};

function parseLegacyGenre(genre?: string | null): string[] | undefined {
  if (!genre) return undefined;
  const parsed = genre
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : undefined;
}

function parseLegacyAuthorList(author?: string | null): string[] {
  if (!author) return [];
  return Array.from(
    new Set(
      author
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeBook(row: LegacyAuthorBookRow): Book {
  const genres = row.genres ?? parseLegacyGenre(row.genre);
  const normalizedAuthors = row.authors?.map((value) => value.trim()).filter(Boolean) ?? [];
  const legacyAuthors = parseLegacyAuthorList(row.author);
  const authors =
    normalizedAuthors.length > 0
      ? normalizedAuthors
      : legacyAuthors.length > 0
        ? legacyAuthors
        : ["Unknown"];

  return {
    ...row,
    authors,
    genres,
  };
}

function toLegacyGenrePayload<T extends { genres?: string[] }>(payload: T): Omit<T, "genres"> & { genre?: string } {
  const { genres, ...rest } = payload;
  return {
    ...rest,
    genre: genres?.length ? genres.join(", ") : undefined,
  };
}

function isMissingGenresColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  return message.toLowerCase().includes("genres") && message.toLowerCase().includes("column");
}

function toLegacyAuthorPayload<T extends { authors?: string[] }>(
  payload: T,
): Omit<T, "authors"> & { author?: string } {
  const { authors, ...rest } = payload;
  if (!authors) {
    return {
      ...rest,
    };
  }

  return {
    ...rest,
    author: authors.join(", "),
  };
}

function isMissingAuthorsColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  return message.toLowerCase().includes("authors") && message.toLowerCase().includes("column");
}

// ── Books ──────────────────────────────────────────────────────────────────

export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as LegacyAuthorBookRow[]).map(normalizeBook);
}

export type BookInsert = Omit<Book, "created_at">;

export async function createBook(payload: BookInsert): Promise<Book> {
  const { data, error } = await supabase
    .from("books")
    .insert(payload)
    .select()
    .single();
  if (!error) return normalizeBook(data as LegacyAuthorBookRow);

  if (isMissingAuthorsColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("books")
      .insert(toLegacyAuthorPayload(payload))
      .select()
      .single();
    if (legacyError) throw legacyError;
    return normalizeBook(legacyData as LegacyAuthorBookRow);
  }

  if (!isMissingGenresColumnError(error)) throw error;

  const { data: legacyData, error: legacyError } = await supabase
    .from("books")
    .insert(toLegacyGenrePayload(payload))
    .select()
    .single();
  if (legacyError) throw legacyError;
  return normalizeBook(legacyData as LegacyAuthorBookRow);
}

export async function updateBook(
  id: string,
  payload: Partial<Omit<Book, "id" | "user_id" | "created_at">>
): Promise<Book> {
  const { data, error } = await supabase
    .from("books")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (!error) return normalizeBook(data as LegacyAuthorBookRow);

  if (isMissingAuthorsColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("books")
      .update(toLegacyAuthorPayload(payload))
      .eq("id", id)
      .select()
      .single();
    if (legacyError) throw legacyError;
    return normalizeBook(legacyData as LegacyAuthorBookRow);
  }

  if (!isMissingGenresColumnError(error)) throw error;

  const { data: legacyData, error: legacyError } = await supabase
    .from("books")
    .update(toLegacyGenrePayload(payload))
    .eq("id", id)
    .select()
    .single();
  if (legacyError) throw legacyError;
  return normalizeBook(legacyData as LegacyAuthorBookRow);
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) throw error;
}

// ── Cover Storage ──────────────────────────────────────────────────────────

function coverPath(userId: string, bookId: string, ext: string): string {
  return `${userId}/${bookId}.${ext}`;
}

const VALID_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"];

export async function uploadCover(
  userId: string,
  bookId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!VALID_IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error(`Invalid file type ".${ext}". Allowed: ${VALID_IMAGE_EXTENSIONS.join(", ")}`);
  }
  const path = coverPath(userId, bookId, ext);
  const { error } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("covers").getPublicUrl(path);
  const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${data.publicUrl}?v=${cacheBuster}`;
}

export async function deleteCover(
  userId: string,
  bookId: string
): Promise<void> {
  // Best-effort — try common extensions; doesn't throw if not found
  const paths = ["jpg", "jpeg", "png", "webp", "avif"].map((e) =>
    coverPath(userId, bookId, e)
  );
  await supabase.storage.from("covers").remove(paths);
}

// ── Series ─────────────────────────────────────────────────────────────────

export async function fetchSeries(): Promise<Series[]> {
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .order("name");
  if (error) throw error;
  return data as Series[];
}

export async function createSeries(userId: string, name: string): Promise<Series> {
  const { data, error } = await supabase
    .from("series")
    .insert({ name, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Series;
}

// ── Reading Logs ──────────────────────────────────────────────────────────

export async function createReadingLog(
  bookId: string,
  userId: string,
  currentPage: number,
  readingTimeMinutes?: number,
  loggedAt?: string
): Promise<ReadingLog> {
  const { data, error } = await supabase
    .from("reading_logs")
    .insert({
      book_id: bookId,
      user_id: userId,
      current_page: currentPage,
      reading_time_minutes: readingTimeMinutes,
      ...(loggedAt ? { logged_at: loggedAt } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data as ReadingLog;
}

export async function fetchLastReadingLog(
  bookId: string
): Promise<ReadingLog | null> {
  const { data, error } = await supabase
    .from("reading_logs")
    .select("*")
    .eq("book_id", bookId)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ReadingLog | null;
}

export async function fetchReadingLogsForBook(
  bookId: string
): Promise<ReadingLog[]> {
  const { data, error } = await supabase
    .from("reading_logs")
    .select("*")
    .eq("book_id", bookId)
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReadingLog[];
}

export async function fetchReadingLogsInRange(
  startIso: string,
  endIso: string
): Promise<ReadingLog[]> {
  const { data, error } = await supabase
    .from("reading_logs")
    .select("*")
    .gte("logged_at", startIso)
    .lte("logged_at", endIso)
    .order("logged_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReadingLog[];
}
