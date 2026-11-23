import type { Book, BookJournalEntryRecord } from "@/types";

export type RankedBook = { book: Book; value: number };

export type BookRankings = {
  rating: RankedBook[];
  length: RankedBook[];
  annotations: RankedBook[];
};

export function getBookRankings(books: Book[], entries: BookJournalEntryRecord[]): BookRankings {
  const annotationCounts = new Map(books.map((book) => [book.id, 0]));
  for (const entry of entries) {
    const count = annotationCounts.get(entry.book_id);
    if (count !== undefined && (entry.label === "note" || entry.label === "quote")) {
      annotationCounts.set(entry.book_id, count + 1);
    }
  }

  return {
    rating: books
      .flatMap((book) => book.is_favorite || typeof book.rating === "number"
        ? [{ book, value: book.is_favorite ? 6 : book.rating ?? 0 }]
        : [])
      .sort((a, b) => b.value - a.value || a.book.title.localeCompare(b.book.title, undefined, { sensitivity: "base", numeric: true })),
    length: books
      .flatMap((book) => typeof book.total_pages === "number" && book.total_pages > 0
        ? [{ book, value: book.total_pages }]
        : [])
      .sort((a, b) => b.value - a.value),
    annotations: books
      .map((book) => ({ book, value: annotationCounts.get(book.id) ?? 0 }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value),
  };
}
