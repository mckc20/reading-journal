import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortGenreBooks, getFavoriteGenres, getMainGenreCollection, selectGenreCovers, sortGenresByRecentBooks, summarizeGenreBooks } from "../src/lib/genreCollection";
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
  assert.deepEqual(summary, { total: 9, finished: 6, reading: 1, ratedCount: 2, averageRating: 4, enjoymentScore: 2, smallSample: true });
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
  assert.equal(getFavoriteGenres(collection).length, 2);
});

test("rankings use enjoyment score then average, sample size and name, exclude unrated genres and limit to five", () => {
  const rankedGenres = [genre("fiction", "Fiction"), ...["Zeta", "Alpha", "Beta", "Delta", "Epsilon", "Gamma", "Empty"].map((name) => genre(name, name, "fiction"))];
  const books = [
    book("z", { genre_ids: ["Zeta"], rating: 5 }),
    ...["Alpha", "Beta", "Delta", "Epsilon", "Gamma"].flatMap((name) => [
      book(`${name}1`, { genre_ids: [name], rating: 4 }),
      ...(name === "Beta" ? [book("Beta2", { genre_ids: [name], rating: 4 })] : []),
    ]),
  ];
  const collection = getMainGenreCollection(rankedGenres, books);
  assert.deepEqual(getFavoriteGenres(collection).map((entry) => entry.genre.name), ["Zeta", "Beta", "Alpha", "Delta", "Epsilon"]);
  // Display rounding must not turn different averages into a name-based tie.
  const close = collection.slice(0, 2).map((entry, index) => ({ ...entry, averageRating: index ? 4.04 : 4.01 }));
  assert.equal(getFavoriteGenres(close)[0].averageRating, 4.04);
  assert.deepEqual(getFavoriteGenres([]), []);
});

test("favorite genres reward sustained enjoyment rather than a tiny perfect sample or volume alone", () => {
  const books = [
    ...Array.from({ length: 30 }, (_, index) => book(`history${index}`, { genre_ids: ["history"], rating: 4.2 })),
    ...Array.from({ length: 2 }, (_, index) => book(`fantasy${index}`, { rating: 5 })),
    ...Array.from({ length: 100 }, (_, index) => book(`romance${index}`, { genre_ids: ["romance"], rating: 3 })),
  ];
  const collection = getMainGenreCollection(genres, books);
  const original = structuredClone(collection);
  const favorites = getFavoriteGenres(collection);
  assert.deepEqual(favorites.map((entry) => entry.genre.name), ["History", "Fantasy", "Romance"]);
  assert.ok(Math.abs(favorites[0].enjoymentScore - 36) < 0.000001);
  assert.equal(favorites[1].enjoymentScore, 4);
  assert.equal(favorites[2].enjoymentScore, 0);
  assert.deepEqual(collection, original);
});

test("enjoyment includes negative and fractional ratings but excludes unrated and unfinished books", () => {
  const summary = summarizeGenreBooks([
    book("five", { rating: 5 }), book("four", { rating: 4 }), book("neutral", { rating: 3 }),
    book("two", { rating: 2 }), book("one", { rating: 1 }), book("half", { rating: 3.5 }),
    book("unrated"), book("invalid", { rating: 6 }), book("nan", { rating: NaN }),
    book("reading", { status: "Reading", rating: 5 }), book("dnf", { status: "DNF", rating: 1 }),
  ]);
  assert.equal(summary.enjoymentScore, 0.5);
  assert.equal(summary.ratedCount, 6);
  assert.equal(summarizeGenreBooks([book("low", { rating: 1 })]).enjoymentScore, -2);
  assert.equal(summarizeGenreBooks([]).enjoymentScore, 0);
});

test("favorite scores include descendants once and a shared book contributes to each main genre", () => {
  const collection = getMainGenreCollection(genres, [book("shared", {
    genre_ids: ["fantasy", "epic", "history", "ya"], rating: 5,
  })]);
  assert.deepEqual(getFavoriteGenres(collection).map((entry) => [entry.genre.name, entry.enjoymentScore, entry.ratedCount]),
    [["Fantasy", 2, 1], ["History", 2, 1]]);
});

test("equal enjoyment scores prefer average then rated count then name, retaining neutral and negative scores", () => {
  const base = getMainGenreCollection(genres, [book("rated", { rating: 4 })])[0];
  const entries = [
    { ...base, genre: { ...base.genre, name: "Zeta" }, enjoymentScore: 2, averageRating: 4, ratedCount: 2 },
    { ...base, genre: { ...base.genre, name: "Beta" }, enjoymentScore: 2, averageRating: 5, ratedCount: 1 },
    { ...base, genre: { ...base.genre, name: "Alpha" }, enjoymentScore: 2, averageRating: 4, ratedCount: 2 },
    { ...base, genre: { ...base.genre, name: "Larger sample" }, enjoymentScore: 2, averageRating: 4, ratedCount: 3 },
    { ...base, genre: { ...base.genre, name: "Neutral" }, enjoymentScore: 0, averageRating: 3 },
    { ...base, genre: { ...base.genre, name: "Negative" }, enjoymentScore: -1, averageRating: 2 },
  ];
  assert.deepEqual(getFavoriteGenres(entries).map((entry) => entry.genre.name), ["Beta", "Larger sample", "Alpha", "Zeta", "Neutral"]);
  assert.equal(getFavoriteGenres(entries.slice(-1))[0].genre.name, "Negative");
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

test("genre status filters support several statuses and clearing the selection", () => {
  const books = [book("a", { status: "Reading" }), book("b", { status: "Paused" }), book("c", { status: "Finished" })];
  assert.deepEqual(filterAndSortGenreBooks(books, ["Reading", "Paused"], "title").map((book) => book.id), ["a", "b"]);
  assert.equal(filterAndSortGenreBooks(books, [], "title").length, 3);
  assert.deepEqual(books.map((book) => book.id), ["a", "b", "c"]);
});

test("genre sorting reverses title and rating while leaving unrated books last", () => {
  const books = [book("a", { rating: 2 }), book("b", { rating: 5 }), book("c")];
  assert.deepEqual(filterAndSortGenreBooks(books, [], "title", "desc").map((book) => book.id), ["c", "b", "a"]);
  assert.deepEqual(filterAndSortGenreBooks(books, [], "rating", "asc").map((book) => book.id), ["a", "b", "c"]);
  assert.deepEqual(filterAndSortGenreBooks(books, [], "rating", "desc").map((book) => book.id), ["b", "a", "c"]);
});

test("genre finish sorting supports both directions and keeps missing dates last", () => {
  const books = [book("a", { date_finished: "2026-01-01" }), book("b", { date_finished: "2026-02-01" }),
    book("c", { status: "Reading", date_finished: "2026-03-01" }), book("d", { date_finished: "invalid" })];
  assert.deepEqual(filterAndSortGenreBooks(books, [], "recently-finished", "asc").map((book) => book.id), ["a", "b", "c", "d"]);
  assert.deepEqual(filterAndSortGenreBooks(books, [], "recently-finished", "desc").map((book) => book.id), ["b", "a", "c", "d"]);
});
