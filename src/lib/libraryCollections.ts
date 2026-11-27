import type { BookStatus, BookUpdate } from "@/types";
import type { CustomCollection } from "./customCollections";

export const libraryCollections = ["To Read", "DNF", "Wishlist", "Favorites"] as const;
export type CollectionId = (typeof libraryCollections)[number];
export const wishlistCollectionPath = "/library/collections?collection=Wishlist";
export const myCollectionsPath = "/library/collections#my-collections";

export function isCustomCollectionId(value: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

export function compareCollectionNames(a: CustomCollection, b: CustomCollection) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);
}

export function parseCollectionId(value: string | null) {
  return libraryCollections.find(id => id === value) ?? null;
}

export function belongsToCollection(id: CollectionId, book: { status: BookStatus; favorite?: boolean }) {
  return id === "Favorites" ? book.favorite && book.status !== "Wishlist" : book.status === id;
}

export function collectionMembershipUpdate(id: CollectionId): BookUpdate {
  return id === "Favorites" ? { is_favorite: true } : { status: id };
}

export function formatCollectionBookCount(count: number) {
  return `${count} ${count === 1 ? "book" : "books"}`;
}
