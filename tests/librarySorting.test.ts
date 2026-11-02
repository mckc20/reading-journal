import assert from "node:assert/strict";
import test from "node:test";
import { defaultSortDirection, librarySorts, normalizeLibrarySort, sortLibraryBooks } from "../src/lib/librarySorting";
import type { Book } from "../src/types";

const books = [
  { id: "b", title: "Beta", authors: ["Zed"], created_at: "2026-02-01", date_finished: "2026-04-01", rating: 5, total_pages: 400 },
  { id: "a", title: "Alpha", authors: ["Ada"], created_at: "2026-01-01", date_finished: "2026-03-01", rating: 2, total_pages: 100 },
  { id: "missing", title: "Unknown", authors: [], created_at: "invalid", date_finished: null, rating: null, total_pages: 0 },
] as Book[];
const ids = (items: Book[]) => items.map((book) => book.id);

test("every book sort supports both directions and keeps missing values last", () => {
  const logs = new Map([["a", Date.parse("2026-05-01")], ["b", Date.parse("2026-06-01")]]);
  for (const sort of librarySorts) {
    const ascending = ["a", "b", "missing"];
    const descending = sort === "title" ? ["missing", "b", "a"] : ["b", "a", "missing"];
    assert.deepEqual(ids(sortLibraryBooks(books, sort, logs, "asc")), ascending, sort);
    assert.deepEqual(ids(sortLibraryBooks(books, sort, logs, "desc")), descending, sort);
  }
  assert.deepEqual(ids(books), ["b", "a", "missing"], "does not mutate its input");
});

test("equal and missing primary values retain title order in both directions", () => {
  const tied = books.map((book) => ({ ...book, rating: 4 }));
  for (const direction of ["asc", "desc"] as const) {
    assert.deepEqual(ids(sortLibraryBooks(tied, "rating", undefined, direction)), ["a", "b", "missing"]);
    assert.deepEqual(ids(sortLibraryBooks(tied.map((book) => ({ ...book, rating: null })), "rating", undefined, direction)), ["a", "b", "missing"]);
  }
});

test("last read uses logs before finish dates and falls back to finish dates", () => {
  assert.deepEqual(ids(sortLibraryBooks(books, "last-read", new Map([["a", Date.parse("2026-07-01")]]))), ["a", "b", "missing"]);
});

test("sort choices have sensible defaults and legacy rating links remain valid", () => {
  assert.equal(defaultSortDirection("title"), "asc");
  assert.equal(defaultSortDirection("page-count"), "asc");
  assert.equal(defaultSortDirection("rating"), "desc");
  assert.equal(normalizeLibrarySort("highest-rated"), "rating");
  assert.equal(normalizeLibrarySort("lowest-rated"), "rating");
  assert.equal(normalizeLibrarySort("progress"), "title");
});
