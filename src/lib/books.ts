import { supabase } from "./supabase";
import { getSelectedGenreTags } from "@/lib/genres";
import { replaceBookAuthors } from "@/lib/authors";
import { deletePublicImageVariants, uploadPublicImage } from "@/lib/storage";
import type { Book, BookPausePeriod, BookUpdate, Genre, ReadingLog, Series, SeriesStatus } from "@/types";

type SeriesRow = Omit<Series, "is_favorite"> & {
  is_favorite?: boolean | null;
};

type LegacyAuthorBookRow = Omit<Book, "authors"> & {
  authors?: string[] | null;
  author?: string | null;
  genre?: string | null;
  book_authors?: Array<{
    position?: number | null;
    author?: {
      id: string;
      name: string;
    } | null;
  }> | null;
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

function normalizeAuthorName(author: string): string {
  return author.trim().replace(/\s+/g, " ");
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
  const joinedAuthors = (row.book_authors ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((item) => item.author?.name?.trim())
    .filter((value): value is string => Boolean(value));
  const normalizedAuthors = row.authors?.map(normalizeAuthorName).filter(Boolean) ?? [];
  const legacyAuthors = parseLegacyAuthorList(row.author);
  const authors =
    joinedAuthors.length > 0
      ? Array.from(new Set(joinedAuthors))
      : normalizedAuthors.length > 0
        ? Array.from(new Set(normalizedAuthors))
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

function normalizeSeries(row: SeriesRow): Series {
  return {
    ...row,
    is_favorite: Boolean(row.is_favorite),
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

function withoutAuthorsPayload<T extends { authors?: unknown }>(payload: T): Omit<T, "authors"> {
  const { authors: _authors, ...rest } = payload;
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

function isMissingAuthorRelationsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message).toLowerCase() : "";
  const details = "details" in error ? String((error as { details: unknown }).details).toLowerCase() : "";
  const combined = `${message} ${details}`;

  return (
    combined.includes("book_authors") ||
    (combined.includes("authors") && combined.includes("relation")) ||
    (combined.includes("authors") && combined.includes("column")) ||
    (combined.includes("authors") && combined.includes("null value")) ||
    (combined.includes("authors") && combined.includes("not-null"))
  );
}

function isMissingNormalizedAuthorsSupportError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message).toLowerCase() : "";
  const details = "details" in error ? String((error as { details: unknown }).details).toLowerCase() : "";
  const combined = `${message} ${details}`;

  return (
    combined.includes("authors") &&
    (combined.includes("book_authors") ||
      combined.includes("relation") ||
      combined.includes("column") ||
      combined.includes("null value") ||
      combined.includes("not-null"))
  );
}

// ── Books ──────────────────────────────────────────────────────────────────

export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*, book_genres(genre:genres(*)), book_authors(position, author:authors(*)), book_pause_periods(*)")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingPausePeriodsRelationError(error)) {
      const { data: pauseLegacyData, error: pauseLegacyError } = await supabase
        .from("books")
        .select("*, book_genres(genre:genres(*)), book_authors(position, author:authors(*))")
        .order("created_at", { ascending: false });
      if (!pauseLegacyError) {
        return ((pauseLegacyData ?? []) as LegacyAuthorBookRow[]).map((row) => normalizeBook(row));
      }
      if (!isMissingGenreTablesError(pauseLegacyError) && !isMissingAuthorRelationsError(pauseLegacyError)) {
        throw pauseLegacyError;
      }
    }
    if (!isMissingGenreTablesError(error) && !isMissingAuthorRelationsError(error)) throw error;

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
  is_favorite?: boolean;
  cover_url?: string | null;
  journal_content?: string | null;
};

function isMissingSeriesOptionalColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message).toLowerCase() : "";
  const details = "details" in error ? String((error as { details: unknown }).details).toLowerCase() : "";
  const combined = `${message} ${details}`;

  return (
    combined.includes("series") &&
    combined.includes("column") &&
    (
      combined.includes("description") ||
      combined.includes("status") ||
      combined.includes("is_favorite") ||
      combined.includes("cover_url") ||
      combined.includes("journal_content")
    )
  );
}

async function insertBookPayload(payload: BookInsert): Promise<Book> {
  const { bookPayload, genreIds } = splitGenrePayload(payload);
  const normalizedPayload = withoutAuthorsPayload(bookPayload);
  const { error } = await supabase
    .from("books")
    .insert(normalizedPayload);
  if (!error) {
    if (bookPayload.authors) {
      await replaceBookAuthors(payload.id, payload.user_id, bookPayload.authors);
    }
    if (genreIds) await replaceBookGenres(payload.id, genreIds);
    return fetchBookById(payload.id);
  }

  if (isMissingNormalizedAuthorsSupportError(error)) {
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

export async function updateBookSeriesPlacement(
  id: string,
  payload: { series_id?: string | null; volume_number?: number | null },
): Promise<Book> {
  const updatePayload: { series_id?: string | null; volume_number?: number | null } = {};
  if ("series_id" in payload) updatePayload.series_id = payload.series_id;
  if ("volume_number" in payload) updatePayload.volume_number = payload.volume_number;

  if (Object.keys(updatePayload).length === 0) return fetchBookById(id);

  const { error } = await supabase
    .from("books")
    .update(updatePayload)
    .eq("id", id);
  if (error) throw error;

  return fetchBookById(id);
}

export async function updateBookVolumeNumber(
  id: string,
  volumeNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ volume_number: volumeNumber })
    .eq("id", id);
  if (error) throw error;
}

async function updateBookPayload(
  id: string,
  payload: BookUpdate,
): Promise<Book> {
  const { bookPayload, genreIds } = splitGenrePayload(payload);
  const normalizedPayload = withoutAuthorsPayload(bookPayload);
  const { data: existingBook, error: existingBookError } = await supabase
    .from("books")
    .select("user_id")
    .eq("id", id)
    .single();
  if (existingBookError) throw existingBookError;

  if (Object.keys(bookPayload).length === 0) {
    if (genreIds) await replaceBookGenres(id, genreIds);
    return fetchBookById(id);
  }

  const { error } = await supabase
    .from("books")
    .update(normalizedPayload)
    .eq("id", id);
  if (!error) {
    if (bookPayload.authors) {
      await replaceBookAuthors(id, existingBook.user_id, bookPayload.authors);
    }
    if (genreIds) await replaceBookGenres(id, genreIds);
    return fetchBookById(id);
  }

  if (isMissingNormalizedAuthorsSupportError(error)) {
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
    .select("*, book_genres(genre:genres(*)), book_authors(position, author:authors(*)), book_pause_periods(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (isMissingPausePeriodsRelationError(error)) {
      const { data: pauseLegacyData, error: pauseLegacyError } = await supabase
        .from("books")
        .select("*, book_genres(genre:genres(*)), book_authors(position, author:authors(*))")
        .eq("id", id)
        .single();
      if (!pauseLegacyError) return normalizeBook(pauseLegacyData as LegacyAuthorBookRow);
      if (!isMissingGenreTablesError(pauseLegacyError) && !isMissingAuthorRelationsError(pauseLegacyError)) {
        throw pauseLegacyError;
      }
    }
    if (!isMissingGenreTablesError(error) && !isMissingAuthorRelationsError(error)) throw error;

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

export async function uploadCover(
  userId: string,
  bookId: string,
  file: File
): Promise<string> {
  const { publicUrl } = await uploadPublicImage("covers", userId, bookId, file);
  return publicUrl;
}

export async function deleteCover(
  userId: string,
  bookId: string
): Promise<void> {
  await deletePublicImageVariants("covers", userId, bookId);
}

export async function uploadSeriesBanner(
  userId: string,
  seriesId: string,
  file: File
): Promise<{ publicUrl: string; extension: string }> {
  const { publicUrl, extension } = await uploadPublicImage("series-banners", userId, seriesId, file);
  return { publicUrl, extension };
}

export async function deleteSeriesBanner(
  userId: string,
  seriesId: string,
  keepExtension?: string | null
): Promise<void> {
  await deletePublicImageVariants("series-banners", userId, seriesId, keepExtension);
}

// ── Series ─────────────────────────────────────────────────────────────────

export async function fetchSeries(): Promise<Series[]> {
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as SeriesRow[]).map(normalizeSeries);
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
      is_favorite: payload.is_favorite ?? false,
      cover_url: payload.cover_url ?? null,
      journal_content: payload.journal_content ?? null,
      user_id: userId,
    })
    .select()
    .single();
  if (error) {
    if (!isMissingSeriesOptionalColumnError(error)) throw error;
    const { data: minimalData, error: minimalError } = await supabase
      .from("series")
      .insert({
        name: payload.name,
        user_id: userId,
      })
      .select()
      .single();
    if (minimalError) throw minimalError;
    return {
      status: "ongoing",
      is_favorite: false,
      ...minimalData,
    } as Series;
  }
  return normalizeSeries(data as SeriesRow);
}

export async function updateSeries(seriesId: string, input: Partial<SeriesInput>): Promise<Series> {
  const payload: Partial<SeriesInput> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) payload.status = input.status;
  if (input.is_favorite !== undefined) payload.is_favorite = input.is_favorite;
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
      ...(payload.is_favorite !== undefined ? { is_favorite: payload.is_favorite } : {}),
      ...(payload.cover_url !== undefined ? { cover_url: payload.cover_url ?? null } : {}),
      ...(payload.journal_content !== undefined
        ? { journal_content: payload.journal_content ?? null }
        : {}),
    })
    .eq("id", seriesId)
    .select()
    .single();
  if (error) throw error;
  return normalizeSeries(data as SeriesRow);
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const { data: existingSeries, error: existingSeriesError } = await supabase
    .from("series")
    .select("user_id")
    .eq("id", seriesId)
    .single();
  if (existingSeriesError) throw existingSeriesError;

  const { error: detachError } = await supabase
    .from("books")
    .update({ series_id: null })
    .eq("series_id", seriesId);
  if (detachError) throw detachError;

  const { error } = await supabase.from("series").delete().eq("id", seriesId);
  if (error) throw error;

  await deleteSeriesBanner(existingSeries.user_id, seriesId).catch(() => {});
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
