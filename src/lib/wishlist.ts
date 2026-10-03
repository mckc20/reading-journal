import { supabase } from "@/lib/supabase";
import { createBook, updateBook, deleteBook, fetchBooks, uploadCover, type BookInsert } from "@/lib/books";
import type { Book, BookUpdate } from "@/types";
import { wishlistDuplicateInput } from "@/lib/wishlistLogic";
import { duplicateBookRecord, type DuplicateOptions } from "@/lib/duplication";
export { findWishlistDuplicates, normalizedIsbn, normalizeWishlistText, wishlistCsv, wishlistDuplicateInput } from "@/lib/wishlistLogic";

type NullableWishlistField = "language" | "format" | "total_pages" | "isbn" | "series_id" | "volume_number";
export type WishlistInput = Pick<Book, "title" | "authors"> &
  Partial<Omit<BookUpdate, NullableWishlistField>> &
  { [K in NullableWishlistField]?: Book[K] | null };

export async function fetchWishlist(): Promise<Book[]> {
  return (await fetchBooks()).filter((book) => book.status === "Wishlist");
}

async function saveCover(book: Book, file?: File): Promise<Book> {
  if (!file) return book;
  try {
    // Copies and migrated books may share URLs: each replacement owns a fresh path.
    const cover_url = await uploadCover(book.user_id, crypto.randomUUID(), file);
    return await updateBook(book.id, { cover_url });
  } catch (error) {
    throw Object.assign(new Error(`Book saved, but cover upload failed: ${error instanceof Error ? error.message : "Upload failed."}`), { item: book });
  }
}

export async function createWishlistItem(userId: string, input: WishlistInput, coverFile?: File): Promise<Book> {
  // PostgreSQL uses NULL to clear optional values; normalized Book fields use undefined.
  const book = await createBook({ ...input, id: crypto.randomUUID(), user_id: userId, status: "Wishlist", is_favorite: input.is_favorite ?? false } as BookInsert);
  return saveCover(book, coverFile);
}

export async function updateWishlistItem(item: Book, input: WishlistInput, coverFile?: File): Promise<Book> {
  return saveCover(await updateBook(item.id, input as BookUpdate), coverFile);
}

export async function duplicateWishlistItem(item: Book, options: DuplicateOptions = { copyJournalEntries: false }): Promise<Book> {
  return duplicateBookRecord({
    ...wishlistDuplicateInput(item),
    id: item.id,
    title: item.title,
    created_at: item.created_at,
  }, item.user_id, options);
}

export async function removeWishlistItem(item: Book): Promise<void> {
  await deleteBook(item.id);
}

/** Move the existing record; do not create a copy or erase reading data. */
export async function moveBookToWishlist(book: Book): Promise<void> {
  await updateBook(book.id, { status: "Wishlist" });
}

/** Conditional update makes retries safe without resetting an already-reading book. */
export async function acquireWishlistItem(id: string): Promise<string> {
  const { error } = await supabase.from("books").update({ status: "To Read" }).eq("id", id).eq("status", "Wishlist");
  if (error) throw error;
  const { error: readError } = await supabase.from("books").select("id").eq("id", id).single();
  if (readError) throw readError;
  return id;
}
