import test from "node:test";
import assert from "node:assert/strict";
import type { Book, Series } from "../src/types/index.js";
import type { BookTitleSearchResult } from "../src/lib/bookLookup.js";
import {
  getNextSeriesVolumeTargets,
  getSeriesCandidateSearchQuery,
  rankSeriesCandidates,
  seriesCandidateIdentity,
} from "../src/lib/seriesVolumeSuggestions.js";

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-1",
    title: "Saga, Book One",
    authors: ["A. Writer"],
    series_id: "series-1",
    status: "To Read",
    is_favorite: false,
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function series(overrides: Partial<Series> = {}): Series {
  return {
    id: "series-1",
    name: "Saga",
    status: "ongoing",
    is_favorite: false,
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function candidate(overrides: Partial<BookTitleSearchResult> = {}): BookTitleSearchResult {
  return {
    id: "https://books.example/volume-2",
    title: "Saga: Volume 2",
    authors: ["A. Writer"],
    metadataSource: "google_books",
    metadataSourceUrl: "https://books.example/volume-2",
    ...overrides,
  };
}

test("finds the volume after the highest owned volume regardless of reading status", () => {
  const first = book({ id: "first", volume_number: 1, status: "To Read" });
  const third = book({ id: "third", title: "Saga Three", volume_number: 3, status: "Reading" });
  const targets = getNextSeriesVolumeTargets([
    first,
    third,
    book({ id: "unlinked", series_id: undefined, volume_number: 8 }),
    book({ id: "unranked", series_id: "series-1", volume_number: undefined }),
  ], [series()]);

  assert.equal(targets.length, 1);
  assert.equal(targets[0].volumeNumber, 4);
  assert.equal(targets[0].referenceBook.id, "third");
  assert.equal(getSeriesCandidateSearchQuery(targets[0]), "Saga volume 4");
});

test("ranks matching series/volume results and excludes owned or rejected matches", () => {
  const owned = book({ title: "Saga: Volume 2", isbn: "978-1-2345-6789-0" });
  const target = getNextSeriesVolumeTargets([book({ volume_number: 1 })], [series()])[0];
  const exactMatch = candidate({ isbn: "978-1-2345-6789-0" });
  const titleMatch = candidate({ id: "volume-2-other", title: "Saga Volume 2", isbn: undefined });
  const authorMatch = candidate({ id: "author-match", title: "Another novel", authors: ["A. Writer"] });
  const unrelated = candidate({ id: "unrelated", title: "Gardening Basics", authors: ["Different Author"] });
  const rejectedKey = seriesCandidateIdentity(titleMatch);

  const ranked = rankSeriesCandidates(
    target,
    [exactMatch, authorMatch, unrelated, titleMatch],
    [owned],
    new Set([rejectedKey]),
  );

  assert.deepEqual(ranked.map((item) => item.id), ["author-match"]);
});

test("uses ISBN identity when catalog records have it", () => {
  const a = candidate({ isbn: "978-1-2345-6789-0" });
  const b = candidate({ id: "different-record", isbn: "9781234567890" });
  assert.equal(seriesCandidateIdentity(a), seriesCandidateIdentity(b));
});
