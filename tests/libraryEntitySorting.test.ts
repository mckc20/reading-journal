import type { Book } from "../src/types";
import type { SeriesBookGroup } from "../src/lib/libraryShelves";
import assert from "node:assert/strict";
import test from "node:test";
import { authorSortOptions, sortLibraryAuthors, sortLibrarySeries } from "../src/lib/libraryEntitySorting";
import type { AuthorSummary } from "../src/lib/authorShelf";

const authors = [
  { name: "Beta", created_at: "2026-02-01", latestReadDate: "2026-04-01", averageRating: 5, statusCounts: { read: 10 } },
  { name: "Alpha", created_at: "2026-01-01", latestReadDate: "2026-03-01", averageRating: 2, statusCounts: { read: 1 } },
  { name: "Unknown", created_at: "invalid", latestReadDate: null, averageRating: null, statusCounts: { read: 0 } },
] as AuthorSummary[];
const names = (items: Array<{ name: string }>) => items.map((item) => item.name);

test("author sorting reverses every property and leaves missing values last", () => {
  for (const { value: sort } of authorSortOptions) {
    const asc = sort === "most-read" ? ["Unknown", "Alpha", "Beta"] : ["Alpha", "Beta", "Unknown"];
    const desc = sort === "name" ? ["Unknown", "Beta", "Alpha"] : ["Beta", "Alpha", "Unknown"];
    assert.deepEqual(names(sortLibraryAuthors(authors, sort, "asc")), asc, sort);
    assert.deepEqual(names(sortLibraryAuthors(authors, sort, "desc")), desc, sort);
  }
  assert.deepEqual(names(authors), ["Beta", "Alpha", "Unknown"]);
});

test("author rating ties use name order in either direction", () => {
  const tied = authors.map((author) => ({ ...author, averageRating: 4 }));
  assert.deepEqual(names(sortLibraryAuthors(tied, "top-rated", "asc")), ["Alpha", "Beta", "Unknown"]);
  assert.deepEqual(names(sortLibraryAuthors(tied, "top-rated", "desc")), ["Alpha", "Beta", "Unknown"]);
});

test("series sort naturally by name in either direction without changing their books", () => {
  const series = [{ name: "Series 10", seriesId: "10", books: [] }, { name: "Series 2", seriesId: "2", books: [] }];
  assert.deepEqual(names(sortLibrarySeries(series, "name", "asc")), ["Series 2", "Series 10"]);
  assert.deepEqual(names(sortLibrarySeries(series, "name", "desc")), ["Series 10", "Series 2"]);
  assert.deepEqual(names(series), ["Series 10", "Series 2"]);
  assert.equal(sortLibrarySeries(series, "name", "asc")[0].books, series[1].books);
});

const seriesGroups: SeriesBookGroup[] = [
  { seriesId: "beta", name: "Beta", books: [
    { id: "b1", rating: 5, date_finished: "2026-02-01" },
    { id: "b2", rating: 3 },
    { id: "b3", rating: undefined },
  ] as Book[] },
  { seriesId: "alpha", name: "Alpha", books: [{ id: "a1", rating: 3, date_finished: "2026-03-01" }] as Book[] },
  { seriesId: "empty", name: "Empty", books: [] },
  { seriesId: "unread", name: "Unread", books: [{ id: "u1" }] as Book[] },
];

test("series Date Added uses the series creation date, including empty series", () => {
  const context = { seriesCreatedAtById: new Map([["alpha", "2026-01-01"], ["beta", "2026-02-01"], ["empty", "2026-03-01"], ["unread", "invalid"]]) };
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "date-added", "asc", context)), ["Alpha", "Beta", "Empty", "Unread"]);
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "date-added", "desc", context)), ["Empty", "Beta", "Alpha", "Unread"]);
});

test("series Rating averages rated books and keeps unrated series last in both directions", () => {
  // Beta averages 4 across its two rated books; its third book is excluded.
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "rating", "desc")), ["Beta", "Alpha", "Empty", "Unread"]);
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "rating", "asc")), ["Alpha", "Beta", "Empty", "Unread"]);
});

test("series Book Count includes unrated and unread books and sorts zero as a real count", () => {
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "book-count", "asc")), ["Empty", "Alpha", "Unread", "Beta"]);
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "book-count", "desc")), ["Beta", "Alpha", "Unread", "Empty"]);
});

test("series Last Read uses the latest activity across all books, with finish dates as fallback", () => {
  const context = { latestReadTimesByBook: new Map([["b1", Date.parse("2026-01-01")], ["b2", Date.parse("2026-04-01")]]) };
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "last-read", "desc", context)), ["Beta", "Alpha", "Empty", "Unread"]);
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "last-read", "asc", context)), ["Alpha", "Beta", "Empty", "Unread"]);
  assert.deepEqual(names(sortLibrarySeries(seriesGroups, "last-read", "desc")), ["Alpha", "Beta", "Empty", "Unread"]);
});
