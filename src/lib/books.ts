import { supabase } from "./supabase";
import { getSelectedGenreTags } from "@/lib/genres";
import type {
  Book,
  BookPausePeriod,
  BookUpdate,
  Genre,
  ReadingLog,
  Series,
  SeriesStatus,
} from "@/types";

type LegacyAuthorBookRow = Omit<Book, "authors"> & {
  authors?: string[] | null;
  author?: string | null;
  genre?: string | null;
  book_genres?: Array<{ genre?: Genre | null }>;
  pause_periods?: BookPausePeriod[] | null;
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
  const selectedGenres = (row.book_genres ?? [])
    .map((item) => item.genre)
    .filter((genre): genre is Genre => Boolean(genre));
  const displayGenres = selectedGenres.length > 0 ? getSelectedGenreTags(selectedGenres) : [];
  const pausePeriods = (row.pause_periods ?? [])
    .map((period) => ({
      ...period,
      resumed_at: period.resumed_at ?? null,
    }))
    .sort((a, b) => new Date(a.paused_at).getTime() - new Date(b.paused_at).getTime());
  const genres =
    displayGenres.length > 0
      ? displayGenres.map((genre) => genre.name)
      : row.genres ?? parseLegacyGenre(row.genre);
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
    genre_ids: selectedGenres.map((genre) => genre.id),
    selected_genres: selectedGenres,
    genre_paths: displayGenres.length > 0 ? displayGenres.map((genre) => genre.name) : genres,
    genres,
    pause_periods: pausePeriods,
  };
}

function toLegacyGenrePayload<T extends { genres?: string[] }>(payload: T): Omit<T, "genres"> & { genre?: string } {
  const { genres, ...rest } = payload;
  return {
    ...rest,
    genre: genres?.length ? genres.join(", ") : undefined,
  };
}

function splitGenrePayload<T extends { genre_ids?: string[]; genres?: string[]; selected_genres?: Genre[]; genre_paths?: string[] }>(
  payload: T,
): { bookPayload: Omit<T, "genre_ids" | "selected_genres" | "genre_paths">; genreIds?: string[] } {
  const {
    genre_ids: genreIds,
    selected_genres: _selectedGenres,
    genre_paths: _genrePaths,
    ...bookPayload
  } = payload;

  return { bookPayload, genreIds };
}

function isMissingGenresColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  return message.toLowerCase().includes("genres") && message.toLowerCase().includes("column");
}

function isMissingGenreTablesError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message).toLowerCase() : "";
  const details = "details" in error ? String((error as { details: unknown }).details).toLowerCase() : "";
  const combined = `${message} ${details}`;

  return (
    combined.includes("book_genres") ||
    combined.includes("relationship") && combined.includes("genres") ||
    combined.includes("relation") && combined.includes("genres")
  );
}

function isMissingPausePeriodsRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message).toLowerCase() : "";
  const details = "details" in error ? String((error as { details: unknown }).details).toLowerCase() : "";
  const combined = `${message} ${details}`;

  return combined.includes("book_pause_periods") || combined.includes("pause_periods");
}

function withoutMetadataSourcePayload<
  T extends { metadata_source?: unknown; metadata_source_url?: unknown },
>(payload: T): Omit<T, "metadata_source" | "metadata_source_url"> {
  const { metadata_source: _metadataSource, metadata_source_url: _metadataSourceUrl, ...rest } = payload;
  return rest;
}

function isMissingMetadataSourceColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("metadata_source") || normalized.includes("metadata_source_url"))
  );
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
    .select("*, book_genres(genre:genres(*)), book_pause_periods(*)")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingPausePeriodsRelationError(error)) {
      const { data: pauseLegacyData, error: pauseLegacyError } = await supabase
        .from("books")
        .select("*, book_genres(genre:genres(*))")
        .order("created_at", { ascending: false });
      if (!pauseLegacyError) {
        return ((pauseLegacyData ?? []) as LegacyAuthorBookRow[]).map((row) => normalizeBook(row));
      }
      if (!isMissingGenreTablesError(pauseLegacyError)) throw pauseLegacyError;
    }
    if (!isMissingGenreTablesError(error)) throw error;

    const { data: legacyData, error: legacyError } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
    if (legacyError) throw legacyError;
    return ((legacyData ?? []) as LegacyAuthorBookRow[]).map((row) => normalizeBook(row));
  }
  return ((data ?? []) as LegacyAuthorBookRow[]).map((row) => normalizeBook(row));
}

export type BookInsert = Omit<Book, "created_at">;

export type SeriesInput = {
  name: string;
  description?: string | null;
  status?: SeriesStatus;
  cover_url?: string | null;
  journal_content?: string | null;
};

async function insertBookPayload(payload: BookInsert): Promise<Book> {
  const { bookPayload, genreIds } = splitGenrePayload(payload);
  const { error } = await supabase
    .from("books")
    .insert(bookPayload);
  if (!error) {
    if (genreIds) await replaceBookGenres(payload.id, genreIds);
    return fetchBookById(payload.id);
  }

  if (isMissingAuthorsColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("books")
      .insert(toLegacyAuthorPayload(bookPayload))
      .select()
      .single();
    if (legacyError) throw legacyError;
    if (genreIds) await replaceBookGenres(payload.id, genreIds).catch(() => {});
    return normalizeBook(legacyData as LegacyAuthorBookRow);
  }

  if (!isMissingGenresColumnError(error)) throw error;

  const { data: legacyData, error: legacyError } = await supabase
    .from("books")
    .insert(toLegacyGenrePayload(bookPayload))
    .select()
    .single();
  if (legacyError) throw legacyError;
  return normalizeBook(legacyData as LegacyAuthorBookRow);
}

export async function createBook(payload: BookInsert): Promise<Book> {
  try {
    return await insertBookPayload(payload);
  } catch (error) {
    if (!isMissingMetadataSourceColumnError(error)) throw error;
    return insertBookPayload(withoutMetadataSourcePayload(payload) as BookInsert);
  }
}

export async function updateBook(
  id: string,
  payload: BookUpdate,
): Promise<Book> {
  try {
    return await updateBookPayload(id, payload);
  } catch (error) {
    if (!isMissingMetadataSourceColumnError(error)) throw error;
    return updateBookPayload(
      id,
      withoutMetadataSourcePayload(payload) as BookUpdate,
    );
  }
}

async function updateBookPayload(
  id: string,
  payload: BookUpdate,
): Promise<Book> {
  const { bookPayload, genreIds } = splitGenrePayload(payload);
  if (Object.keys(bookPayload).length === 0) {
    if (genreIds) await replaceBookGenres(id, genreIds);
    return fetchBookById(id);
  }

  const { error } = await supabase
    .from("books")
    .update(bookPayload)
    .eq("id", id);
  if (!error) {
    if (genreIds) await replaceBookGenres(id, genreIds);
    return fetchBookById(id);
  }

  if (isMissingAuthorsColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("books")
      .update(toLegacyAuthorPayload(bookPayload))
      .eq("id", id)
      .select()
      .single();
    if (legacyError) throw legacyError;
    if (genreIds) await replaceBookGenres(id, genreIds).catch(() => {});
    return normalizeBook(legacyData as LegacyAuthorBookRow);
  }

  if (!isMissingGenresColumnError(error)) throw error;

  const { data: legacyData, error: legacyError } = await supabase
    .from("books")
    .update(toLegacyGenrePayload(bookPayload))
    .eq("id", id)
    .select()
    .single();
  if (legacyError) throw legacyError;
  return normalizeBook(legacyData as LegacyAuthorBookRow);
}

async function runPauseBookMutation(
  fnName: "pause_book" | "resume_book",
  bookId: string,
): Promise<Book> {
  const { error } = await supabase.rpc(fnName, { book_uuid: bookId });
  if (error) throw error;
  return fetchBookById(bookId);
}

export async function pauseBook(id: string): Promise<Book> {
  return runPauseBookMutation("pause_book", id);
}

export async function resumeBook(id: string): Promise<Book> {
  return runPauseBookMutation("resume_book", id);
}

async function fetchBookById(id: string): Promise<Book> {
  const { data, error } = await supabase
    .from("books")
    .select("*, book_genres(genre:genres(*)), book_pause_periods(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (isMissingPausePeriodsRelationError(error)) {
      const { data: pauseLegacyData, error: pauseLegacyError } = await supabase
        .from("books")
        .select("*, book_genres(genre:genres(*))")
        .eq("id", id)
        .single();
      if (!pauseLegacyError) return normalizeBook(pauseLegacyData as LegacyAuthorBookRow);
      if (!isMissingGenreTablesError(pauseLegacyError)) throw pauseLegacyError;
    }
    if (!isMissingGenreTablesError(error)) throw error;

    const { data: legacyData, error: legacyError } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .single();
    if (legacyError) throw legacyError;
    return normalizeBook(legacyData as LegacyAuthorBookRow);
  }
  return normalizeBook(data as LegacyAuthorBookRow);
}

async function replaceBookGenres(bookId: string, genreIds: string[]): Promise<void> {
  const uniqueGenreIds = Array.from(new Set(genreIds.filter(Boolean)));

  const { error: deleteError } = await supabase
    .from("book_genres")
    .delete()
    .eq("book_id", bookId);
  if (deleteError) {
    if (uniqueGenreIds.length === 0 && isMissingGenreTablesError(deleteError)) return;
    throw deleteError;
  }

  if (uniqueGenreIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("book_genres")
    .insert(uniqueGenreIds.map((genreId) => ({ book_id: bookId, genre_id: genreId })));
  if (insertError) throw insertError;
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

export async function createSeries(userId: string, input: string | SeriesInput): Promise<Series> {
  const payload =
    typeof input === "string"
      ? { name: input }
      : input;
  const { data, error } = await supabase
    .from("series")
    .insert({
      name: payload.name,
      description: payload.description?.trim() || null,
      status: payload.status ?? "ongoing",
      cover_url: payload.cover_url ?? null,
      journal_content: payload.journal_content ?? null,
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Series;
}

export async function updateSeries(seriesId: string, input: Partial<SeriesInput>): Promise<Series> {
  const payload: Partial<SeriesInput> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) payload.status = input.status;
  if (input.cover_url !== undefined) payload.cover_url = input.cover_url;
  if (input.journal_content !== undefined) payload.journal_content = input.journal_content;

  const { data, error } = await supabase
    .from("series")
    .update({
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description?.trim() || null }
        : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.cover_url !== undefined ? { cover_url: payload.cover_url ?? null } : {}),
      ...(payload.journal_content !== undefined
        ? { journal_content: payload.journal_content ?? null }
        : {}),
    })
    .eq("id", seriesId)
    .select()
    .single();
  if (error) throw error;
  return data as Series;
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const { error: detachError } = await supabase
    .from("books")
    .update({ series_id: null })
    .eq("series_id", seriesId);
  if (detachError) throw detachError;

  const { error } = await supabase.from("series").delete().eq("id", seriesId);
  if (error) throw error;
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

export async function fetchReadingLogs(): Promise<ReadingLog[]> {
  const { data, error } = await supabase
    .from("reading_logs")
    .select("*")
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
