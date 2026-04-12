import { supabase } from "./supabase";
import type { Book, Series, ReadingLog } from "@/types";

// ── Books ──────────────────────────────────────────────────────────────────

export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Book[];
}

export type BookInsert = Omit<Book, "created_at">;

export async function createBook(payload: BookInsert): Promise<Book> {
  const { data, error } = await supabase
    .from("books")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Book;
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
  if (error) throw error;
  return data as Book;
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
  return data.publicUrl;
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
  readingTimeMinutes?: number
): Promise<ReadingLog> {
  const { data, error } = await supabase
    .from("reading_logs")
    .insert({
      book_id: bookId,
      user_id: userId,
      current_page: currentPage,
      reading_time_minutes: readingTimeMinutes,
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
