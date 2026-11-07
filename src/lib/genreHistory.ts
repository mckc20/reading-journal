import type { Book, Genre } from "../types";
import { parseLocalDateOnly } from "./bookAnalytics";
import { compareBookTitles, getFavoriteGenres, getMainGenreCollection, summarizeGenreBooks } from "./genreCollection";
import { getBooksForGenreSubtree } from "./genreTree";

export function getGenreHistoryOptions(books: Book[], genres: Genre[]) {
  return getMainGenreCollection(genres, books).filter((entry) => {
    const finishedYears = new Set(entry.books.flatMap((book) => {
      if (book.status !== "Finished") return [];
      const date = parseLocalDateOnly(book.date_finished);
      return date ? [date.getFullYear()] : [];
    }));
    return finishedYears.size >= 2;
  });
}

export function getDefaultHistoryGenre(books: Book[], genres: Genre[]): string | null {
  const options = getGenreHistoryOptions(books, genres);
  return getFavoriteGenres(options)[0]?.genre.id
    ?? [...options].sort((a, b) => b.finished - a.finished || a.genre.name.localeCompare(b.genre.name))[0]?.genre.id
    ?? null;
}

export function getHistoryWindowBounds(currentYear: number, earliestYear: number | null) {
  return { minEndYear: Math.min(currentYear, (earliestYear ?? currentYear) + 4), maxEndYear: currentYear };
}

/** Dates stay in their stored calendar year; missing ratings never become zero. */
export function buildGenreHistory(books: Book[], genres: Genre[], genreId: string, endYear: number, startYear = endYear - 4) {
  const finished = [...new Map(getBooksForGenreSubtree(books, genreId, genres)
    .filter((book) => book.status === "Finished").map((book) => [book.id, book])).values()];
  const dated = finished.flatMap((book) => {
    const date = parseLocalDateOnly(book.date_finished);
    return date ? [{ book, year: date.getFullYear() }] : [];
  });
  return {
    finishedCount: finished.length,
    ratedCount: summarizeGenreBooks(finished).ratedCount,
    excludedDateCount: finished.length - dated.length,
    earliestYear: dated.length ? Math.min(...dated.map((entry) => entry.year)) : null,
    years: Array.from({ length: endYear - startYear + 1 }, (_, index) => {
      const year = startYear + index;
      const matching = dated.filter((entry) => entry.year === year).map((entry) => entry.book).sort(compareBookTitles);
      const summary = summarizeGenreBooks(matching);
      return { year, finishedCount: summary.finished, ratedCount: summary.ratedCount,
        averageRating: summary.averageRating, books: matching };
    }),
  };
}
