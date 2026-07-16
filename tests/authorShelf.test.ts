import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuthorSummaries,
  findAuthorSummary,
  formatAuthorPartialDate,
  formatAuthorYear,
} from "../src/lib/authorShelf";
import {
  sortAuthorsForTopShelf,
  sortAuthorsByMostRead,
} from "../src/lib/authorsView";
import type { Author, Book, BookJournalEntryRecord } from "../src/types";

test("builds author summaries from author rows and linked books", () => {
  const authors = buildAuthorSummaries(
    [
      makeAuthor({
        id: "haruki-murakami",
        name: "Haruki Murakami",
        is_favorite: true,
        created_at: "2020-01-01T00:00:00Z",
      }),
      makeAuthor({
        id: "another-author",
        name: "Another Author",
        created_at: "2026-01-01T00:00:00Z",
      }),
    ],
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
        status: "To Read",
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

  const murakami = authors.find((author) => author.id === "haruki-murakami");

  assert.ok(murakami);
  assert.equal(murakami?.bookCount, 3);
  assert.equal(murakami?.quoteCount, 2);
  assert.equal(murakami?.averageRating, 4.5);
  assert.equal(murakami?.firstReadDate, "2021-01-10");
  assert.equal(murakami?.latestReadDate, "2025-03-01");
  assert.equal(murakami?.isFavorite, true);
  assert.deepEqual(murakami?.statusCounts, {
    read: 1,
    reading: 1,
    wantToRead: 1,
  });
  assert.deepEqual(
    murakami?.shelfGroups.map((group) => [group.key, group.books.map((book) => book.id)]),
    [
      ["read", ["norwegian-wood"]],
      ["reading", ["after-dark"]],
      ["want-to-read", ["dance"]],
    ],
  );
});

test("finds an author by stable id", () => {
  const authors = buildAuthorSummaries([
    makeAuthor({
      id: "octavia-butler",
      name: "Octavia E. Butler",
    }),
  ]);

  assert.equal(findAuthorSummary(authors, "octavia-butler")?.name, "Octavia E. Butler");
});

test("formats missing author dates as empty friendly text", () => {
  assert.equal(formatAuthorYear(null), "No date yet");
  assert.equal(formatAuthorPartialDate("2026-05-14", "day"), "May 14, 2026");
});

test("orders top authors by favorites first and then rating", () => {
  const authors = buildAuthorSummaries([
    makeAuthor({
      id: "favorite-low",
      name: "Favorite Low",
      is_favorite: true,
    }),
    makeAuthor({
      id: "non-favorite-high",
      name: "Non Favorite High",
    }),
    makeAuthor({
      id: "favorite-high",
      name: "Favorite High",
      is_favorite: true,
    }),
  ]);

  const summaries = authors.map((author) => ({
    ...author,
    averageRating:
      author.id === "favorite-low" ? 3 : author.id === "favorite-high" ? 5 : 4,
    statusCounts: {
      read: author.id === "favorite-low" ? 1 : author.id === "favorite-high" ? 2 : 3,
      reading: 0,
      wantToRead: 0,
    },
  }));

  assert.deepEqual(
    sortAuthorsForTopShelf(summaries).map((author) => author.id),
    ["favorite-high", "favorite-low", "non-favorite-high"],
  );
});

test("keeps most-read authors above the minimum finished-book threshold", () => {
  const authors = buildAuthorSummaries([
    makeAuthor({ id: "three-read", name: "Three Read" }),
    makeAuthor({ id: "two-read", name: "Two Read" }),
  ]).map((author) => ({
    ...author,
    statusCounts: {
      read: author.id === "three-read" ? 3 : 2,
      reading: 0,
      wantToRead: 0,
    },
  }));

  assert.deepEqual(sortAuthorsByMostRead(authors).map((author) => author.id), ["three-read", "two-read"]);
});

function makeAuthor(overrides: Partial<Author>): Author {
  return {
    id: "author-1",
    user_id: "user-1",
    name: "Author",
    photo_url: null,
    birth_date: null,
    birth_date_precision: null,
    death_date: null,
    death_date_precision: null,
    bio: null,
    is_favorite: false,
    nationality: null,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
    ...overrides,
  };
}

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

function makeNote(overrides: Partial<BookJournalEntryRecord>): BookJournalEntryRecord {
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
    entry_date: "2026-05-01",
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
    ...overrides,
  };
}
