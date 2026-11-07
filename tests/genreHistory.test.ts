import assert from "node:assert/strict";
import test from "node:test";
import { buildGenreHistory, getDefaultHistoryGenre, getGenreHistoryOptions, getHistoryWindowBounds } from "../src/lib/genreHistory";
import type { Book, Genre } from "../src/types";

const genre = (id: string, name: string, parent_id: string | null = null): Genre => ({
  id, name, parent_id, is_system: true, created_at: "2026-01-01", updated_at: "2026-01-01",
});
const genres = [genre("fiction", "Fiction"), genre("fantasy", "Fantasy", "fiction"),
  genre("epic", "Epic", "fantasy"), genre("romance", "Romance", "fiction"),
  genre("age", "Age Target"), genre("ya", "Young Adult", "age")];
const book = (id: string, changes: Partial<Book> = {}): Book => ({
  id, title: id, authors: [], genre_ids: ["fantasy"], status: "Finished", rating: null,
  is_favorite: false, user_id: "user", created_at: "2026-01-01", date_finished: "2026-01-01", ...changes,
});

test("calendar grouping preserves year boundaries, empty years and partial current-year data", () => {
  const books = [book("last", { date_finished: "2025-12-31", rating: 3 }),
    book("first", { rating: 5 }), book("older", { date_finished: "2010-06-01" }),
    book("leap", { date_finished: "2024-02-29", rating: 4 })];
  const original = structuredClone(books);
  const result = buildGenreHistory(books, genres, "fantasy", 2026);
  assert.equal(result.earliestYear, 2010);
  assert.deepEqual(result.years.map((entry) => [entry.year, entry.finishedCount, entry.averageRating]),
    [[2022, 0, null], [2023, 0, null], [2024, 1, 4], [2025, 1, 3], [2026, 1, 5]]);
  assert.deepEqual(books, original);
});

test("an extended range keeps earlier years available for continuous timeline browsing", () => {
  const result = buildGenreHistory([
    book("old", { date_finished: "2018-12-31", rating: 4 }),
    book("recent", { rating: 5 }),
  ], genres, "fantasy", 2026, 2018);
  assert.deepEqual(result.years.map((entry) => entry.year), [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.equal(result.years[0].averageRating, 4);
  assert.equal(result.years[8].averageRating, 5);
  assert.ok(result.years.slice(1, 8).every((entry) => entry.finishedCount === 0 && entry.averageRating === null));
});

test("counts include unrated finished books; averages use only valid ratings", () => {
  const result = buildGenreHistory([book("a", { rating: 5 }), book("b", { rating: 2.5 }), book("unrated"),
    ...[0, 6, NaN, Infinity].map((rating, index) => book(`invalid${index}`, { rating })),
    book("reading", { status: "Reading", rating: 1 }), book("dnf", { status: "DNF", rating: 1 }),
    book("paused", { status: "Paused", rating: 1 })], genres, "fantasy", 2026);
  assert.equal(result.finishedCount, 7);
  assert.equal(result.years[4].ratedCount, 2);
  assert.equal(result.years[4].averageRating, 3.75);
});

test("missing, malformed and impossible dates are disclosed and excluded", () => {
  const books = [undefined, "", "invalid", "2025-02-29", "2026-04-31", "2026-13-01", "2026-01-01T00:00:00Z"]
    .map((date_finished, index) => book(`${index}`, { date_finished, rating: 4 }));
  const result = buildGenreHistory(books, genres, "fantasy", 2026);
  assert.equal(result.excludedDateCount, 7);
  assert.equal(result.finishedCount, 7);
  assert.equal(result.earliestYear, null);
  assert.ok(result.years.every((entry) => entry.finishedCount === 0 && entry.averageRating === null));
});

test("subtree matching deduplicates descendant tags and book IDs and sorts matching books", () => {
  const shared = book("z", { genre_ids: ["fantasy", "epic"], rating: 5 });
  const result = buildGenreHistory([shared, shared, book("a", { genre_ids: ["epic"] }),
    book("other", { genre_ids: ["romance"] })], genres, "fantasy", 2026);
  assert.equal(result.finishedCount, 2);
  assert.equal(result.years[4].ratedCount, 1);
  assert.deepEqual(result.years[4].books.map((entry) => entry.id), ["a", "z"]);
});

test("empty and unrated histories keep null averages, including a single rated year", () => {
  assert.equal(buildGenreHistory([], genres, "fantasy", 2026).finishedCount, 0);
  const unrated = buildGenreHistory([book("a")], genres, "fantasy", 2026);
  assert.equal(unrated.ratedCount, 0);
  assert.equal(unrated.years[4].averageRating, null);
  const rated = buildGenreHistory([book("a", { rating: 4 })], genres, "fantasy", 2026);
  assert.equal(rated.years.filter((entry) => entry.averageRating !== null).length, 1);
});

test("defaults follow ranking then finished count then name among eligible genres", () => {
  const books = [book("fantasy", { rating: 4 }), book("romance", { genre_ids: ["romance"], rating: 5 }),
    book("audience", { genre_ids: ["ya"], rating: 5 }),
    book("fantasy-old", { date_finished: "2025-01-01", rating: 4 }),
    book("romance-old", { genre_ids: ["romance"], date_finished: "2025-01-01", rating: 5 })];
  assert.equal(getDefaultHistoryGenre(books, genres), "romance");
  assert.equal(getDefaultHistoryGenre(books.map((entry) => ({ ...entry, rating: null })), genres), "fantasy");
  assert.equal(getDefaultHistoryGenre([...books.map((entry) => ({ ...entry, rating: null })),
    book("more", { genre_ids: ["romance"] })], genres), "romance");
  assert.equal(getDefaultHistoryGenre([], genres), null);
  assert.deepEqual(getGenreHistoryOptions([book("unread", { status: "To Read" })], genres), []);
});

test("selector requires finished books with valid dates in two distinct years across all history", () => {
  const current = book("current", { genre_ids: ["fantasy", "epic"] });
  const sameYear = book("same-year", { date_finished: "2026-12-31" });
  const old = book("old", { genre_ids: ["epic"], date_finished: "2010-01-01" });
  assert.deepEqual(getGenreHistoryOptions([current, current, sameYear], genres), []);
  assert.deepEqual(getGenreHistoryOptions([current, old], genres).map((entry) => entry.genre.id), ["fantasy"]);
  for (const extra of [book("missing", { date_finished: undefined }),
    book("invalid", { date_finished: "2025-02-29" }),
    book("reading", { status: "Reading", date_finished: "2025-01-01" })]) {
    assert.deepEqual(getGenreHistoryOptions([current, extra], genres), []);
  }
  // An ineligible genre must not become the default even with the highest rating.
  assert.equal(getDefaultHistoryGenre([current, old,
    book("high", { genre_ids: ["romance"], rating: 5 })], genres), "fantasy");
});

test("window bounds stop when earliest history is visible and never extend beyond the current year", () => {
  assert.deepEqual(getHistoryWindowBounds(2026, 2010), { minEndYear: 2014, maxEndYear: 2026 });
  assert.deepEqual(getHistoryWindowBounds(2026, 2025), { minEndYear: 2026, maxEndYear: 2026 });
  assert.deepEqual(getHistoryWindowBounds(2026, null), { minEndYear: 2026, maxEndYear: 2026 });
});
