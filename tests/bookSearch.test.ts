import assert from "node:assert/strict";
import test from "node:test";
import { searchBooks, type BookSearchPropertyKey } from "../src/lib/bookSearch";
import type { Book, Series } from "../src/types";

const series: Series[] = [
  {
    id: "series-1",
    name: "The Broken Earth",
    user_id: "user-1",
    created_at: "2026-04-01T10:00:00Z",
  },
];

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: "book-1",
    title: "The Fifth Season",
    authors: ["N. K. Jemisin"],
    genres: ["Fantasy", "Science Fiction"],
    status: "Reading",
    rating: 5,
    is_favorite: true,
    current_page: 120,
    total_pages: 512,
    date_started: "2026-04-10",
    language: "English",
    belongs_to: "Me",
    format: "Paperback",
    isbn: "9780316229296",
    series_id: "series-1",
    volume_number: 1,
    user_id: "user-1",
    created_at: "2026-04-01T10:00:00Z",
    ...overrides,
  };
}

function sectionKeys(query: string, selectedProperties?: BookSearchPropertyKey[]) {
  return searchBooks([makeBook({})], query, { series, selectedProperties }).map(
    (section) => section.property.key
  );
}

test("matches case-insensitive partial title queries", () => {
  const sections = searchBooks([makeBook({})], "fif", { series });

  assert.deepEqual(
    sections.map((section) => section.property.key),
    ["title"]
  );
  assert.equal(sections[0].matches[0].book.title, "The Fifth Season");
  assert.deepEqual(sections[0].matches[0].values, ["The Fifth Season"]);
});

test("matches array fields like authors and genres", () => {
  assert.deepEqual(sectionKeys("jem"), ["authors"]);
  assert.deepEqual(sectionKeys("fant"), ["genres"]);
});

test("resolves series names from series_id", () => {
  const sections = searchBooks([makeBook({})], "broken", { series });

  assert.deepEqual(
    sections.map((section) => section.property.key),
    ["series"]
  );
  assert.deepEqual(sections[0].matches[0].values, ["The Broken Earth"]);
});

test("groups results by every matched property", () => {
  const sections = searchBooks([makeBook({})], "paper", { series });

  assert.deepEqual(
    sections.map((section) => section.property.key),
    ["format"]
  );
  assert.deepEqual(sections[0].matches.map((match) => match.book.id), ["book-1"]);
});

test("repeats a book across multiple matched property sections", () => {
  const book = makeBook({
    title: "English Lessons",
    genres: ["English history"],
    language: "English",
  });

  const sections = searchBooks([book], "english", { series });

  assert.deepEqual(
    sections.map((section) => section.property.key),
    ["title", "genres", "language"]
  );
  assert.deepEqual(
    sections.flatMap((section) => section.matches.map((match) => match.book.id)),
    ["book-1", "book-1", "book-1"]
  );
});

test("limits results to selected property filters", () => {
  const book = makeBook({
    title: "English Lessons",
    genres: ["English history"],
    language: "English",
  });

  const sections = searchBooks([book], "english", {
    series,
    selectedProperties: ["language"],
  });

  assert.deepEqual(
    sections.map((section) => section.property.key),
    ["language"]
  );
});

test("returns no sections for an empty query", () => {
  assert.deepEqual(searchBooks([makeBook({})], "   ", { series }), []);
});

test("matches favorite searches only for books marked as favorite", () => {
  const favorite = makeBook({ id: "favorite-book", is_favorite: true });
  const notFavorite = makeBook({ id: "regular-book", is_favorite: false });

  const sections = searchBooks([favorite, notFavorite], "is favorite", { series });

  assert.deepEqual(
    sections.map((section) => section.property.key),
    ["favorite"]
  );
  assert.deepEqual(
    sections[0].matches.map((match) => match.book.id),
    ["favorite-book"]
  );
  assert.deepEqual(sections[0].matches[0].values, ["Is favorite"]);
});

test("searches user-visible property values but not internal fields", () => {
  const book = makeBook({
    id: "hidden-id-match",
    user_id: "hidden-user-match",
    created_at: "hidden-created-match",
    cover_url: "https://example.com/hidden-cover-match.jpg",
    metadata_source_url: "https://example.com/hidden-source-match",
  });

  assert.deepEqual(searchBooks([book], "hidden", { series }), []);
});
