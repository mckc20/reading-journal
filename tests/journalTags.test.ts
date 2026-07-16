import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeJournalTags,
  suggestAuthorJournalTags,
  suggestBookJournalTags,
  suggestSeriesJournalTags,
} from "../src/lib/journalTags";
import type { Book, BookJournalEntryRecord, SeriesJournalEntryRecord } from "../src/types";

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: "book-1",
    title: "Book",
    authors: ["Author"],
    status: "Unread",
    is_favorite: false,
    user_id: "user-1",
    created_at: "2026-07-01T08:00:00Z",
    ...overrides,
  };
}

function makeBookJournalEntryRecord(overrides: Partial<BookJournalEntryRecord>): BookJournalEntryRecord {
  return {
    id: "note-1",
    user_id: "user-1",
    book_id: "book-1",
    label: "note",
    title: null,
    quote_speaker: null,
    content: "Content",
    tags: null,
    page_start: null,
    is_favorite: false,
    entry_date: "2026-07-01",
    created_at: "2026-07-01T08:00:00Z",
    updated_at: "2026-07-01T08:00:00Z",
    ...overrides,
  };
}

function makeSeriesJournalEntryRecord(overrides: Partial<SeriesJournalEntryRecord>): SeriesJournalEntryRecord {
  return {
    id: "series-note-1",
    user_id: "user-1",
    series_id: "series-1",
    title: null,
    content: "Content",
    tags: null,
    entry_date: "2026-07-01",
    created_at: "2026-07-01T08:00:00Z",
    updated_at: "2026-07-01T08:00:00Z",
    ...overrides,
  };
}

test("normalizes journal tags by trimming blanks and deduplicating case-insensitively", () => {
  assert.deepEqual(normalizeJournalTags([" theme ", "Theme", "", "craft"]), ["theme", "craft"]);
});

test("suggests book journal tags from same-genre books only", () => {
  const currentBook = makeBook({ id: "current", genres: ["Fantasy"] });
  const similarBook = makeBook({ id: "similar", genres: ["Fantasy"] });
  const unrelatedBook = makeBook({ id: "unrelated", genres: ["Memoir"] });

  assert.deepEqual(
    suggestBookJournalTags(currentBook, [currentBook, similarBook, unrelatedBook], [
      makeBookJournalEntryRecord({ book_id: "similar", tags: ["magic", "theme"] }),
      makeBookJournalEntryRecord({ book_id: "unrelated", tags: ["history"] }),
    ]),
    ["magic", "theme"],
  );
});

test("suggests series journal tags from existing series journalEntries", () => {
  assert.deepEqual(
    suggestSeriesJournalTags([
      makeSeriesJournalEntryRecord({ tags: ["arc", "theme"] }),
      makeSeriesJournalEntryRecord({ tags: ["arc"] }),
    ]),
    ["arc", "theme"],
  );
});

test("suggests author journal tags from the author's books", () => {
  const authorBook = makeBook({ id: "author-book", authors: ["Author"] });

  assert.deepEqual(
    suggestAuthorJournalTags([authorBook], [
      makeBookJournalEntryRecord({ book_id: "author-book", tags: ["voice"] }),
      makeBookJournalEntryRecord({ book_id: "other-book", tags: ["outside"] }),
    ]),
    ["voice"],
  );
});
