import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNoteGroups,
  buildRatingGroups,
  buildSeriesGroups,
  buildShelfValueSummaries,
  filterBooksByShelfValue,
} from "../src/lib/libraryShelves";
import type { Book, BookNote, Series } from "../src/types";

test("groups favorite books above ratings without duplicating them", () => {
  const groups = buildRatingGroups([
    makeBook({ id: "favorite-five", title: "Favorite Five", rating: 5, is_favorite: true }),
    makeBook({ id: "regular-five", title: "Regular Five", rating: 5 }),
    makeBook({ id: "four-star", title: "Four Star", rating: 4 }),
    makeBook({ id: "unrated", title: "Unrated", rating: null }),
  ]);

  assert.deepEqual(
    groups.map((group) => ({
      name: group.name,
      books: group.books.map((book) => book.id),
    })),
    [
      { name: "Favorites", books: ["favorite-five"] },
      { name: "5 Stars", books: ["regular-five"] },
      { name: "4 Stars", books: ["four-star"] },
      { name: "Unrated", books: ["unrated"] },
    ],
  );
});

test("groups notes by label and puts favorite quotes first", () => {
  const book = makeBook({ id: "book-1", title: "Book One" });
  const groups = buildNoteGroups(
    [
      makeNote({
        id: "regular-quote",
        label: "quote",
        content: "Regular quote",
        note_date: "2026-05-06",
      }),
      makeNote({
        id: "favorite-quote",
        label: "quote",
        content: "Favorite quote",
        is_favorite: true,
        note_date: "2026-05-01",
      }),
      makeNote({ id: "review", label: "review", content: "Review" }),
      makeNote({ id: "note", label: "note", content: "Note" }),
    ],
    [book],
  );

  assert.deepEqual(
    groups.map((group) => ({
      name: group.name,
      notes: group.notes.map((note) => note.id),
    })),
    [
      { name: "Quotes", notes: ["favorite-quote", "regular-quote"] },
      { name: "Reviews", notes: ["review"] },
      { name: "Notes", notes: ["note"] },
    ],
  );
});

test("summarizes shelf values by book count and then name", () => {
  const books = [
    makeBook({ id: "fantasy-a", title: "Fantasy A", genres: ["Fantasy", "Adventure"] }),
    makeBook({ id: "fantasy-b", title: "Fantasy B", genres: ["Fantasy"] }),
    makeBook({ id: "mystery", title: "Mystery", genres: ["Mystery"] }),
    makeBook({ id: "adventure", title: "Adventure", genres: ["Adventure"] }),
  ];

  const summaries = buildShelfValueSummaries({
    shelf: "genres",
    books,
    series: [],
  });

  assert.deepEqual(summaries, [
    { name: "Adventure", count: 2 },
    { name: "Fantasy", count: 2 },
    { name: "Mystery", count: 1 },
  ]);
});

test("summarizes duplicate values once per book", () => {
  const summaries = buildShelfValueSummaries({
    shelf: "authors",
    books: [
      makeBook({ id: "book-a", authors: ["Robin Hobb", "Robin Hobb"] }),
      makeBook({ id: "book-b", authors: ["Robin Hobb"] }),
    ],
    series: [],
  });

  assert.deepEqual(summaries, [{ name: "Robin Hobb", count: 2 }]);
});

test("keeps rating shelf values in rating order instead of count order", () => {
  const summaries = buildShelfValueSummaries({
    shelf: "rating",
    books: [
      makeBook({ id: "unrated-a", title: "Unrated A", rating: null }),
      makeBook({ id: "unrated-b", title: "Unrated B", rating: null }),
      makeBook({ id: "unrated-c", title: "Unrated C", rating: null }),
      makeBook({ id: "favorite", title: "Favorite", rating: 3, is_favorite: true }),
      makeBook({ id: "five", title: "Five", rating: 5 }),
      makeBook({ id: "four", title: "Four", rating: 4 }),
      makeBook({ id: "two", title: "Two", rating: 2 }),
      makeBook({ id: "one", title: "One", rating: 1 }),
    ],
    series: [],
  });

  assert.deepEqual(summaries, [
    { name: "Favorites", count: 1 },
    { name: "5 Stars", count: 1 },
    { name: "4 Stars", count: 1 },
    { name: "2 Stars", count: 1 },
    { name: "1 Star", count: 1 },
    { name: "Unrated", count: 3 },
  ]);
});

test("filters books by selected multi-value shelf value", () => {
  const books = [
    makeBook({ id: "fantasy", title: "Fantasy", genres: ["Fantasy", "Adventure"] }),
    makeBook({ id: "mystery", title: "Mystery", genres: ["Mystery"] }),
  ];

  const filteredBooks = filterBooksByShelfValue({
    shelf: "genres",
    value: "Fantasy",
    books,
    series: [],
  });

  assert.deepEqual(filteredBooks.map((book) => book.id), ["fantasy"]);
});

test("filters multi-value shelf values case-insensitively", () => {
  const books = [
    makeBook({ id: "fantasy", title: "Fantasy", authors: ["N. K. Jemisin"], genres: ["Fantasy"] }),
    makeBook({ id: "mystery", title: "Mystery", authors: ["Agatha Christie"], genres: ["Mystery"] }),
  ];

  const authorBooks = filterBooksByShelfValue({
    shelf: "authors",
    value: " n. k. jemisin ",
    books,
    series: [],
  });
  const genreBooks = filterBooksByShelfValue({
    shelf: "genres",
    value: " fantasy ",
    books,
    series: [],
  });

  assert.deepEqual(authorBooks.map((book) => book.id), ["fantasy"]);
  assert.deepEqual(genreBooks.map((book) => book.id), ["fantasy"]);
});

test("filters books by selected single-value shelf value", () => {
  const books = [
    makeBook({ id: "paperback", title: "Paperback", format: "Paperback" }),
    makeBook({ id: "ebook", title: "Ebook", format: "eBook" }),
  ];

  const filteredBooks = filterBooksByShelfValue({
    shelf: "format",
    value: "Paperback",
    books,
    series: [],
  });

  assert.deepEqual(filteredBooks.map((book) => book.id), ["paperback"]);
});

test("filters single-value shelf values case-insensitively", () => {
  const books = [
    makeBook({ id: "english-paperback", title: "English Paperback", language: "English", format: "Paperback", source: "Owned" }),
    makeBook({ id: "german-ebook", title: "German Ebook", language: "German", format: "eBook", source: "Library" }),
  ];

  const languageBooks = filterBooksByShelfValue({
    shelf: "languages",
    value: " english ",
    books,
    series: [],
  });
  const formatBooks = filterBooksByShelfValue({
    shelf: "format",
    value: " paperback ",
    books,
    series: [],
  });
  const sourceBooks = filterBooksByShelfValue({
    shelf: "source",
    value: " owned ",
    books,
    series: [],
  });

  assert.deepEqual(languageBooks.map((book) => book.id), ["english-paperback"]);
  assert.deepEqual(formatBooks.map((book) => book.id), ["english-paperback"]);
  assert.deepEqual(sourceBooks.map((book) => book.id), ["english-paperback"]);
});

test("filters books by selected series name", () => {
  const series: Series[] = [
    makeSeries({ id: "series-1", name: "Realm of the Elderlings" }),
    makeSeries({ id: "series-2", name: "Discworld" }),
  ];
  const books = [
    makeBook({ id: "assassin", title: "Assassin's Apprentice", series_id: "series-1" }),
    makeBook({ id: "guards", title: "Guards! Guards!", series_id: "series-2" }),
  ];

  const filteredBooks = filterBooksByShelfValue({
    shelf: "series",
    value: "Realm of the Elderlings",
    books,
    series,
  });

  assert.deepEqual(filteredBooks.map((book) => book.id), ["assassin"]);
});

test("retains the stable series id when grouping series books", () => {
  const groups = buildSeriesGroups(
    [makeBook({ id: "assassin", title: "Assassin's Apprentice", series_id: "series-1" })],
    [makeSeries({ id: "series-1", name: "Realm of the Elderlings" })],
  );

  assert.deepEqual(
    groups.map((group) => ({ seriesId: group.seriesId, name: group.name })),
    [{ seriesId: "series-1", name: "Realm of the Elderlings" }],
  );
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

function makeSeries(overrides: Partial<Series>): Series {
  return {
    id: "series-1",
    name: "Series",
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
    label: "note",
    title: null,
    quote_speaker: null,
    content: "Note",
    page_start: null,
    is_favorite: false,
    note_date: "2026-05-01",
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
    ...overrides,
  };
}
