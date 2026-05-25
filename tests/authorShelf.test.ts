import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthorSummaries,
  findAuthorSummary,
  formatAuthorYear,
} from "../src/lib/authorShelf";
import type { Book, BookNote } from "../src/types";

test("builds author summaries from book authors without an authors table", () => {
  const authors = buildAuthorSummaries(
    [
      makeBook({
        id: "norwegian-wood",
        title: "Norwegian Wood",
        authors: ["Haruki Murakami"],
        status: "Finished",
        rating: 4,
        is_favorite: true,
        date_started: "2021-01-02",
        date_finished: "2021-01-10",
      }),
      makeBook({
        id: "after-dark",
        title: "After Dark",
        authors: ["Haruki Murakami"],
        status: "Reading",
        rating: 5,
        date_started: "2025-03-01",
      }),
      makeBook({
        id: "dance",
        title: "Dance Dance Dance",
        authors: ["Haruki Murakami"],
        status: "Wishlist",
      }),
      makeBook({
        id: "other",
        title: "Other Book",
        authors: ["Another Author"],
        status: "Finished",
      }),
    ],
    [
      makeNote({ id: "quote-1", book_id: "norwegian-wood", label: "quote" }),
      makeNote({ id: "note-1", book_id: "norwegian-wood", label: "note" }),
      makeNote({ id: "quote-2", book_id: "after-dark", label: "quote" }),
    ],
  );

  const murakami = authors.find((author) => author.name === "Haruki Murakami");

  assert.ok(murakami);
  assert.equal(murakami.bookCount, 3);
  assert.equal(murakami.quoteCount, 2);
  assert.equal(murakami.averageRating, 4.5);
  assert.equal(murakami.firstReadDate, "2021-01-10");
  assert.equal(murakami.latestReadDate, "2025-03-01");
  assert.equal(murakami.isFavorite, true);
  assert.deepEqual(murakami.statusCounts, {
    read: 1,
    reading: 1,
    wantToRead: 1,
  });
  assert.deepEqual(
    murakami.shelfGroups.map((group) => [group.key, group.books.map((book) => book.id)]),
    [
      ["read", ["norwegian-wood"]],
      ["reading", ["after-dark"]],
      ["want-to-read", ["dance"]],
    ],
  );
});

test("finds an author from a URL encoded name", () => {
  const authors = buildAuthorSummaries([
    makeBook({ id: "book-1", authors: ["Octavia E. Butler"] }),
  ]);

  assert.equal(findAuthorSummary(authors, "Octavia%20E.%20Butler")?.name, "Octavia E. Butler");
});

test("formats missing author dates as empty friendly text", () => {
  assert.equal(formatAuthorYear(null), "No date yet");
});

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: "book-1",
    title: "Book",
    authors: ["Author"],
    status: "Finished",
    rating: null,
    is_favorite: false,
    user_id: "user-1",
    created_at: "2026-05-01T08:00:00Z",
    ...overrides,
  };
}

function makeNote(overrides: Partial<BookNote>): BookNote {
  return {
    id: "note-1",
    user_id: "user-1",
    book_id: "book-1",
    label: "quote",
    title: null,
    quote_speaker: null,
    content: "A quote",
    page_start: null,
    is_favorite: false,
    note_date: "2026-05-01",
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
    ...overrides,
  };
}
