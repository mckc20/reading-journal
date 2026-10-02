import { supabase } from "@/lib/supabase";
import { uploadCover, deleteCover } from "@/lib/books";
import type { Book, WishlistItem } from "@/types";
export { findWishlistDuplicates, normalizedIsbn, normalizeWishlistText, wishlistCsv } from "@/lib/wishlistLogic";

export type WishlistInput = Omit<WishlistItem, "id" | "user_id" | "book_id" | "created_at" | "updated_at">;


export async function fetchWishlist(): Promise<WishlistItem[]> {
  const { data, error } = await supabase.from("wishlist_items").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WishlistItem[];
}

export async function createWishlistItem(userId: string, input: WishlistInput, coverFile?: File): Promise<WishlistItem> {
  const id = crypto.randomUUID();
  const { data, error } = await supabase.from("wishlist_items").insert({ ...input, id, user_id: userId, cover_entity_id: id }).select().single();
  if (error) throw error;
  let item = data as WishlistItem;
  if (!coverFile) return item;
  try {
    const cover_url = await uploadCover(userId, id, coverFile);
    const { data: updated, error: updateError } = await supabase.from("wishlist_items").update({ cover_url }).eq("id", id).select().single();
    if (updateError) throw updateError;
    item = updated as WishlistItem;
  } catch (error) {
    // The wish itself is still useful; tell the caller that only the optional upload failed.
    throw Object.assign(new Error(`Wishlist item saved, but cover upload failed: ${error instanceof Error ? error.message : "Upload failed."}`), { item });
  }
  return item;
}

export async function removeWishlistItem(item: WishlistItem): Promise<void> {
  const { error } = await supabase.from("wishlist_items").delete().eq("id", item.id);
  if (error) throw error;
  if (!item.book_id && item.cover_entity_id) await deleteCover(item.user_id, item.cover_entity_id).catch(() => {});
}

export async function addBookToWishlist(userId: string, book: Book): Promise<WishlistItem> {
  const { data, error } = await supabase.from("wishlist_items").insert({
    id: crypto.randomUUID(), user_id: userId, book_id: book.id, title: book.title, authors: book.authors,
    genre_ids: book.genre_ids ?? [], genres: book.genres ?? [], cover_url: book.cover_url ?? null,
    cover_entity_id: book.cover_url ? book.id : null, total_pages: book.total_pages ?? null,
    language: book.language ?? null, format: book.format ?? null, isbn: book.isbn ?? null,
    publication_date: book.publication_date ?? null, description: book.description ?? null,
    metadata_source: book.metadata_source ?? null, metadata_source_url: book.metadata_source_url ?? null,
    series_id: book.series_id ?? null, volume_number: book.volume_number ?? null,
  }).select().single();
  if (error) throw error;
  return data as WishlistItem;
}

/** Server-side transaction: safely creates exactly one book and links the wish. */
export async function acquireWishlistItem(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("acquire_wishlist_item", { wishlist_item_uuid: id });
  if (error) throw error;
  return data as string;
}
