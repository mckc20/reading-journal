import type { Book, BookStatus, Genre } from "../types";
import { getBooksForGenreSubtree, isGenreRoot } from "./genreTree";

export type GenreSummary = ReturnType<typeof summarizeGenreBooks>;
export type GenreCollectionEntry = GenreSummary & { genre: Genre; books: Book[] };
export type GenreBookSort = "title" | "rating" | "recently-finished";

export function compareBookTitles(a: Book, b: Book): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
    || a.id.localeCompare(b.id);
}

export function summarizeGenreBooks(books: Book[]) {
  const finished = books.filter((book) => book.status === "Finished");
  const rated = finished.filter((book) => typeof book.rating === "number"
    && Number.isFinite(book.rating) && book.rating >= 1 && book.rating <= 5);
  return {
    total: books.length,
    finished: finished.length,
    reading: books.filter((book) => book.status === "Reading").length,
    ratedCount: rated.length,
    averageRating: rated.length ? rated.reduce((sum, book) => sum + book.rating!, 0) / rated.length : null,
    smallSample: rated.length > 0 && rated.length < 3,
  };
}

/** Organizer roots and audience labels aren't genres for the personal ranking. */
export function getMainGenreCollection(genres: Genre[], books: Book[]): GenreCollectionEntry[] {
  const mainRoots = new Set(genres.filter((genre) => isGenreRoot(genre)
    && (genre.name === "Fiction" || genre.name === "Non-Fiction")).map((genre) => genre.id));
  return genres.filter((genre) => genre.parent_id && mainRoots.has(genre.parent_id))
    .map((genre) => {
      const matching = getBooksForGenreSubtree(books, genre.id, genres);
      return { genre, books: matching, ...summarizeGenreBooks(matching) };
    })
    .sort((a, b) => a.genre.name.localeCompare(b.genre.name, undefined, { sensitivity: "base", numeric: true }));
}

export function getHighestRatedGenres(collection: GenreCollectionEntry[]): GenreCollectionEntry[] {
  return collection.filter((entry) => entry.averageRating !== null)
    .sort((a, b) => b.averageRating! - a.averageRating! || b.ratedCount - a.ratedCount
      || a.genre.name.localeCompare(b.genre.name, undefined, { sensitivity: "base", numeric: true }))
    .slice(0, 5);
}

export function selectGenreCovers(books: Book[]): Book[] {
  return [...books].sort((a, b) => Number(Boolean(b.cover_url)) - Number(Boolean(a.cover_url))
    || Number(b.status === "Finished" && b.is_favorite) - Number(a.status === "Finished" && a.is_favorite)
    || (b.rating ?? -1) - (a.rating ?? -1) || compareBookTitles(a, b)).slice(0, 3);
}

/** Shared taxonomy creation dates don't reflect when a user added books to a genre. */
export function sortGenresByRecentBooks(genres: Genre[], books: Book[]): Genre[] {
  return genres.map((genre) => ({
    genre,
    latestAdded: getBooksForGenreSubtree(books, genre.id, genres).reduce((latest, book) => {
      const added = Date.parse(book.created_at);
      return Number.isFinite(added) ? Math.max(latest, added) : latest;
    }, 0),
  })).sort((a, b) => b.latestAdded - a.latestAdded
    || a.genre.name.localeCompare(b.genre.name, undefined, { sensitivity: "base", numeric: true }))
    .map((entry) => entry.genre);
}

export function filterAndSortGenreBooks(books: Book[], status: BookStatus | "all", sort: GenreBookSort): Book[] {
  return books.filter((book) => status === "all" || book.status === status).sort((a, b) => {
    if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1) || compareBookTitles(a, b);
    if (sort === "recently-finished") {
      // Only completed books have a completion date for this view.
      const dateA = a.status === "Finished" ? a.date_finished ?? "" : "";
      const dateB = b.status === "Finished" ? b.date_finished ?? "" : "";
      return dateB.localeCompare(dateA) || compareBookTitles(a, b);
    }
    return compareBookTitles(a, b);
  });
}
