import type { Book } from "../types";

export function normalizeWishlistText(value: string) { return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
export function normalizedIsbn(value?: string | null) { return value?.replace(/[^\dXx]/g, "").toUpperCase() ?? ""; }
export function findWishlistDuplicates(items: Book[], incoming: Pick<Book, "isbn" | "title" | "authors">) {
  const isbn = normalizedIsbn(incoming.isbn); const title = normalizeWishlistText(incoming.title); const authors = new Set(incoming.authors.map(normalizeWishlistText));
  return items.filter((item) => (isbn && normalizedIsbn(item.isbn) === isbn) || (normalizeWishlistText(item.title) === title && item.authors.some((author) => authors.has(normalizeWishlistText(author)))));
}
export function wishlistDuplicateInput(item: Book): Omit<Book, "id" | "created_at"> {
  return {
    user_id: item.user_id,
    status: "Wishlist",
    is_favorite: false,
    title: `Copy of ${item.title}`,
    authors: item.authors,
    genre_ids: item.genre_ids ?? [],
    genres: item.genres ?? [],
    cover_url: item.cover_url ?? null,
    total_pages: item.total_pages,
    language: item.language,
    format: item.format,
    isbn: item.isbn,
    publication_date: item.publication_date ?? null,
    description: item.description ?? null,
    metadata_source: item.metadata_source ?? null,
    metadata_source_url: item.metadata_source_url ?? null,
    series_id: item.series_id,
    volume_number: item.volume_number,
    price: item.price ?? null,
    purchase_url: item.purchase_url ?? null,
  };
}
export function wishlistCsv(items: Book[]) { const quote = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`; return ["Title,Authors,ISBN,Series ID,Volume,Price,Purchase link", ...items.map((item) => [item.title, item.authors.join("; "), item.isbn, item.series_id, item.volume_number, item.price, item.purchase_url].map(quote).join(","))].join("\n"); }
