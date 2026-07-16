import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeJournalTags,
  suggestAuthorJournalTags,
  suggestBookJournalTags,
  suggestSeriesJournalTags,
} from "../src/lib/journalTags";
import type { Book, BookNote, SeriesNote } from "../src/types";

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

function makeBookNote(overrides: Partial<BookNote>): BookNote {
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
    note_date: "2026-07-01",
    created_at: "2026-07-01T08:00:00Z",
    updated_at: "2026-07-01T08:00:00Z",
    ...overrides,
  };
}

function makeSeriesNote(overrides: Partial<SeriesNote>): SeriesNote {
  return {
    id: "series-note-1",
    user_id: "user-1",
    series_id: "series-1",
    title: null,
    content: "Content",
    tags: null,
    note_date: "2026-07-01",
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
      makeBookNote({ book_id: "similar", tags: ["magic", "theme"] }),
      makeBookNote({ book_id: "unrelated", tags: ["history"] }),
    ]),
    ["magic", "theme"],
  );
});

test("suggests series journal tags from existing series notes", () => {
  assert.deepEqual(
    suggestSeriesJournalTags([
      makeSeriesNote({ tags: ["arc", "theme"] }),
      makeSeriesNote({ tags: ["arc"] }),
    ]),
    ["arc", "theme"],
  );
});

test("suggests author journal tags from the author's books", () => {
  const authorBook = makeBook({ id: "author-book", authors: ["Author"] });

  assert.deepEqual(
    suggestAuthorJournalTags([authorBook], [
      makeBookNote({ book_id: "author-book", tags: ["voice"] }),
      makeBookNote({ book_id: "other-book", tags: ["outside"] }),
    ]),
    ["voice"],
  );
});
