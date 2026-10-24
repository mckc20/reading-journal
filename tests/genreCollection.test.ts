import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortGenreBooks, getHighestRatedGenres, getMainGenreCollection, selectGenreCovers, sortGenresByRecentBooks, summarizeGenreBooks } from "../src/lib/genreCollection";
import type { Book, Genre } from "../src/types";

const genre = (id: string, name: string, parent_id: string | null = null): Genre => ({
  id, name, parent_id, is_system: true, created_at: "2026-01-01", updated_at: "2026-01-01",
});
const genres = [genre("fiction", "Fiction"), genre("nonfiction", "Non-Fiction"), genre("age", "Age Target"),
  genre("fantasy", "Fantasy", "fiction"), genre("epic", "Epic Fantasy", "fantasy"),
  genre("history", "History", "nonfiction"), genre("romance", "Romance", "fiction"), genre("ya", "Young Adult", "age"),
  { ...genre("legacy", "Old category"), is_system: false }];
const book = (id: string, changes: Partial<Book> = {}): Book => ({
  id, title: id, authors: [], genre_ids: ["fantasy"], status: "Finished", rating: null,
  is_favorite: false, user_id: "user", created_at: "2026-01-01", ...changes,
});

test("genre shelf recency follows the newest added book in each subtree, with empty genres last", () => {
  const books = [
    book("old", { genre_ids: ["history"], created_at: "2026-01-01" }),
    book("new", { genre_ids: ["epic", "fantasy"], created_at: "2026-10-01" }),
    book("invalid", { genre_ids: ["romance"], created_at: "invalid" }),
    book("root-only", { genre_ids: ["nonfiction"], created_at: "2026-12-01" }),
  ];
  const original = structuredClone(genres);
  assert.deepEqual(sortGenresByRecentBooks(genres, books).map((genre) => genre.name), [
    "Epic Fantasy", "Fantasy", "Fiction", "History", "Non-Fiction",
    "Age Target", "Old category", "Romance", "Young Adult",
  ]);
  assert.deepEqual(genres, original);
});

test("summary uses only valid ratings on finished books and counts current reading separately", () => {
  const summary = summarizeGenreBooks([
    book("rated", { rating: 5 }), book("rated2", { rating: 3 }), book("unrated"),
    book("zero", { rating: 0 }), book("nan", { rating: NaN }), book("large", { rating: 6 }),
    book("reading", { status: "Reading", rating: 1 }), book("paused", { status: "Paused", rating: 1 }),
    book("dnf", { status: "DNF", rating: 1 }),
  ]);
  assert.deepEqual(summary, { total: 9, finished: 6, reading: 1, ratedCount: 2, averageRating: 4, smallSample: true });
  assert.equal(summarizeGenreBooks([book("a"), book("b", { status: "Reading", rating: 5 })]).averageRating, null);
  assert.equal(summarizeGenreBooks([]).smallSample, false);
  assert.equal(summarizeGenreBooks([book("a", { rating: 4 }), book("b", { rating: 4 }), book("c", { rating: 4 })]).smallSample, false);
});

test("main collections are alphabetical, exclude audience/legacy/root genres, and deduplicate overlapping tags", () => {
  const shared = book("shared", { genre_ids: ["fantasy", "epic", "history", "ya"], rating: 4 });
  const collection = getMainGenreCollection(genres, [shared, book("root", { genre_ids: ["fiction"] })]);
  assert.deepEqual(collection.map((entry) => entry.genre.name), ["Fantasy", "History", "Romance"]);
  assert.deepEqual(collection.map((entry) => entry.total), [1, 1, 0]);
  assert.equal(collection[0].ratedCount, 1);
  assert.equal(collection[0].averageRating, 4);
  assert.equal(getHighestRatedGenres(collection).length, 2);
});

test("rankings use average then sample size then name, exclude unrated genres and limit to five", () => {
  const rankedGenres = [genre("fiction", "Fiction"), ...["Zeta", "Alpha", "Beta", "Delta", "Epsilon", "Gamma", "Empty"].map((name) => genre(name, name, "fiction"))];
  const books = [
    book("z", { genre_ids: ["Zeta"], rating: 5 }),
    ...["Alpha", "Beta", "Delta", "Epsilon", "Gamma"].flatMap((name) => [
      book(`${name}1`, { genre_ids: [name], rating: 4 }),
      ...(name === "Beta" ? [book("Beta2", { genre_ids: [name], rating: 4 })] : []),
    ]),
  ];
  const collection = getMainGenreCollection(rankedGenres, books);
  assert.deepEqual(getHighestRatedGenres(collection).map((entry) => entry.genre.name), ["Zeta", "Beta", "Alpha", "Delta", "Epsilon"]);
  // Display rounding must not turn different averages into a name-based tie.
  const close = collection.slice(0, 2).map((entry, index) => ({ ...entry, averageRating: index ? 4.04 : 4.01 }));
  assert.equal(getHighestRatedGenres(close)[0].averageRating, 4.04);
  assert.deepEqual(getHighestRatedGenres([]), []);
});

test("status and sorting work together without mutating the source, with missing values last", () => {
  const books = [book("z", { title: "Zebra", rating: 5, date_finished: "2026-09-01" }),
    book("a", { title: "Alpha" }), book("b", { title: "Beta", rating: 5, date_finished: "2026-10-01" }),
    book("c", { title: "Current", status: "Reading", rating: 4, date_finished: "2026-12-01" }),
    book("d", { title: "Paused", status: "Paused" })];
  const original = structuredClone(books);
  assert.deepEqual(filterAndSortGenreBooks(books, "all", "title").map((b) => b.id), ["a", "b", "c", "d", "z"]);
  assert.deepEqual(filterAndSortGenreBooks(books, "Finished", "rating").map((b) => b.id), ["b", "z", "a"]);
  assert.deepEqual(filterAndSortGenreBooks(books, "all", "recently-finished").map((b) => b.id), ["b", "z", "a", "c", "d"]);
  assert.deepEqual(filterAndSortGenreBooks(books, "Paused", "rating").map((b) => b.id), ["d"]);
  assert.deepEqual(filterAndSortGenreBooks(books, "DNF", "title"), []);
  assert.deepEqual(books, original);
});

test("cover previews prefer covers, then finished favorites, ratings and title; select at most three", () => {
  const books = [book("missing", { rating: 5, is_favorite: true }),
    book("b", { cover_url: "/b.jpg", rating: 5 }),
    book("favorite", { cover_url: "/f.jpg", rating: 2, is_favorite: true }),
    book("a", { cover_url: "/a.jpg", rating: 5 }),
    book("reading", { cover_url: "/r.jpg", rating: 3, is_favorite: true, status: "Reading" })];
  assert.deepEqual(selectGenreCovers(books).map((b) => b.id), ["favorite", "a", "b"]);
  assert.equal(books[0].id, "missing");
  assert.deepEqual(selectGenreCovers([]), []);
});
