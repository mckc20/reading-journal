import type { WishlistItem } from "@/types";

export function normalizeWishlistText(value: string) { return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
export function normalizedIsbn(value?: string | null) { return value?.replace(/[^\dXx]/g, "").toUpperCase() ?? ""; }
export function findWishlistDuplicates(items: WishlistItem[], incoming: Pick<WishlistItem, "isbn" | "title" | "authors">) {
  const isbn = normalizedIsbn(incoming.isbn); const title = normalizeWishlistText(incoming.title); const authors = new Set(incoming.authors.map(normalizeWishlistText));
  return items.filter((item) => (isbn && normalizedIsbn(item.isbn) === isbn) || (normalizeWishlistText(item.title) === title && item.authors.some((author) => authors.has(normalizeWishlistText(author)))));
}
export function wishlistCsv(items: WishlistItem[]) { const quote = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`; return ["Title,Authors,ISBN,Series ID,Volume,Price,Purchase link,Acquired", ...items.map((item) => [item.title, item.authors.join("; "), item.isbn, item.series_id, item.volume_number, item.price, item.purchase_url, item.book_id ? "Yes" : "No"].map(quote).join(","))].join("\n"); }
