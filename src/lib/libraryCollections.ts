import type { BookStatus, BookUpdate } from "@/types";

export const libraryCollections = ["To Read", "Finished", "DNF", "Wishlist", "Favorites"] as const;
export type CollectionId = (typeof libraryCollections)[number];

export function parseCollectionId(value: string | null) {
  return libraryCollections.find(id => id === value) ?? null;
}

export function belongsToCollection(id: CollectionId, book: { status: BookStatus; favorite?: boolean }) {
  return id === "Favorites" ? book.favorite && book.status !== "Wishlist" : book.status === id;
}

export function collectionMembershipUpdate(id: CollectionId): BookUpdate {
  return id === "Favorites" ? { is_favorite: true } : { status: id };
}
