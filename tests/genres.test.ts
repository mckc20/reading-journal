import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGenreTree,
  buildGenreSlugLookup,
  formatGenrePathForDisplay,
  getBooksForGenreSubtree,
  getDescendantGenreIds,
  getGenreBookCount,
  getGenrePathLabel,
  getMostSpecificGenres,
  getSelectedGenreTags,
  slugifyGenreName,
  mapGenreLabelsToIds,
  searchGenres,
} from "../src/lib/genreTree";
import type { Book, Genre } from "../src/types";

function makeGenre(overrides: Partial<Genre> & Pick<Genre, "id" | "name">): Genre {
  return {
    parent_id: null,
    user_id: null,
    is_system: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const genres = [
  makeGenre({ id: "fiction", name: "Fiction" }),
  makeGenre({ id: "fantasy", name: "Fantasy", parent_id: "fiction" }),
  makeGenre({ id: "epic", name: "Epic Fantasy", parent_id: "fantasy" }),
  makeGenre({ id: "high", name: "High Fantasy", parent_id: "fantasy" }),
  makeGenre({ id: "dark", name: "Dark Fantasy", parent_id: "fantasy" }),
  makeGenre({ id: "nonfiction", name: "Non-Fiction" }),
  makeGenre({ id: "history", name: "History", parent_id: "nonfiction" }),
  makeGenre({ id: "age", name: "Age Target" }),
  makeGenre({ id: "ya", name: "Young Adult", parent_id: "age" }),
];

function makeBook(overrides: Partial<Book> & Pick<Book, "id" | "title" | "genre_ids">): Book {
  return {
    authors: ["Unknown"],
    status: "Unread",
    is_favorite: false,
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("builds an unlimited-depth genre tree", () => {
  const tree = buildGenreTree(genres);
  const fiction = tree.find((genre) => genre.id === "fiction");
  const fantasy = fiction?.children.find((genre) => genre.id === "fantasy");

  assert.equal(fantasy?.children.find((genre) => genre.id === "epic")?.pathLabel, "Fiction -> Fantasy -> Epic Fantasy");
});

test("generates breadcrumb labels from parent relationships", () => {
  assert.equal(getGenrePathLabel("epic", genres), "Fiction -> Fantasy -> Epic Fantasy");
});

test("formats genre paths without top-level section noise", () => {
  assert.equal(formatGenrePathForDisplay("Age Target -> Young Adult"), "Young Adult");
  assert.equal(formatGenrePathForDisplay("Fiction -> Fantasy -> Epic Fantasy"), "Fantasy → Epic Fantasy");
});

test("searches by full path", () => {
  const results = searchGenres(genres, "fiction fantasy epic");

  assert.deepEqual(results.map((result) => result.pathLabel), ["Fiction -> Fantasy -> Epic Fantasy"]);
});

test("keeps only most-specific selected genres for compact display", () => {
  const selected = genres.filter((genre) => ["fantasy", "epic", "history"].includes(genre.id));

  assert.deepEqual(
    getMostSpecificGenres(selected, genres).map((genre) => genre.name),
    ["Epic Fantasy", "History"],
  );
});

test("keeps selected parents as separate tags instead of path prefixes", () => {
  const selected = genres.filter((genre) => ["fantasy", "epic", "history"].includes(genre.id));

  assert.deepEqual(
    getSelectedGenreTags(selected).map((genre) => genre.name),
    ["Epic Fantasy", "Fantasy", "History"],
  );
});

test("maps external genre labels and age labels to known genre ids case-insensitively", () => {
  assert.deepEqual(mapGenreLabelsToIds(["epic fantasy", "History", "young adult", "graphic novel", "Unknown"], genres), [
    "epic",
    "history",
    "ya",
  ]);
});

test("slugifies genre names for readable urls", () => {
  assert.equal(slugifyGenreName("Science Fiction"), "science-fiction");
  assert.equal(slugifyGenreName("Mystery & Crime"), "mystery-crime");
  assert.equal(slugifyGenreName("Children's"), "childrens");
});

test("builds duplicate-safe genre slugs with readable parent fallback", () => {
  const duplicateGenres = [
    ...genres,
    makeGenre({ id: "nonfiction-fantasy", name: "Fantasy", parent_id: "nonfiction" }),
  ];
  const { slugById, genreBySlug } = buildGenreSlugLookup(duplicateGenres);

  assert.equal(slugById.get("fantasy"), "fantasy");
  assert.equal(slugById.get("nonfiction-fantasy"), "non-fiction-fantasy");
  assert.equal(genreBySlug.get("non-fiction-fantasy")?.id, "nonfiction-fantasy");
});

test("collects descendant genre ids for nested trees", () => {
  assert.deepEqual(getDescendantGenreIds("fantasy", genres), ["dark", "epic", "high"]);
});

test("counts parent genre books from direct and descendant assignments", () => {
  const books = [
    makeBook({ id: "direct", title: "Direct Fantasy", genre_ids: ["fantasy"] }),
    makeBook({ id: "child", title: "Epic Fantasy", genre_ids: ["epic"] }),
    makeBook({ id: "both", title: "Both", genre_ids: ["fantasy", "epic"] }),
    makeBook({ id: "other", title: "History", genre_ids: ["history"] }),
  ];

  assert.deepEqual(getGenreBookCount("fantasy", books, genres), {
    direct: 2,
    descendant: 2,
    total: 3,
  });
});

test("ignores direct assignments on root organizer genres", () => {
  const books = [
    makeBook({ id: "root-only", title: "Root Fiction", genre_ids: ["fiction"] }),
    makeBook({ id: "child", title: "Fantasy Book", genre_ids: ["fantasy"] }),
  ];

  assert.deepEqual(getGenreBookCount("fiction", books, genres), {
    direct: 0,
    descendant: 1,
    total: 1,
  });
  assert.deepEqual(
    getBooksForGenreSubtree(books, "fiction", genres).map((book) => book.id),
    ["child"],
  );
});

test("includes child genre books on both child and parent genre pages", () => {
  const books = [
    makeBook({ id: "high-fantasy-book", title: "High Fantasy Book", genre_ids: ["high"] }),
    makeBook({ id: "history-book", title: "History Book", genre_ids: ["history"] }),
  ];

  assert.deepEqual(
    getBooksForGenreSubtree(books, "high", genres).map((book) => book.id),
    ["high-fantasy-book"],
  );
  assert.deepEqual(
    getBooksForGenreSubtree(books, "fantasy", genres).map((book) => book.id),
    ["high-fantasy-book"],
  );
});
