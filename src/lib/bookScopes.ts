import type { Book } from "../types";

/** Keep wishlist records out of existing library and analytics consumers. */
export function splitBookScopes(books: Book[]) {
  return {
    books: books.filter((book) => book.status !== "Wishlist"),
    wishlistBooks: books.filter((book) => book.status === "Wishlist"),
  };
}
