import assert from "node:assert/strict";
import test from "node:test";
import {
  filterSeriesLogs,
  getAverageSeriesRating,
  getBookReadingMinutes,
  getFeaturedNoteCandidates,
  getJourneyBookDates,
  getJourneyDurationDays,
  getLatestSeriesActivity,
  getMostCommonGenre,
  getNextUpBook,
  getSeriesAuthors,
  getSeriesJourneyRecap,
  getSeriesJourneyTransition,
  getSeriesProgress,
  getSeriesStats,
  sortSeriesBooks,
} from "../src/lib/seriesDetails";
import type { Book, BookNote, ReadingLog } from "../src/types";

test("orders numbered series books before unnumbered books with title fallback", () => {
  const sorted = sortSeriesBooks([
    makeBook({ id: "unknown-b", title: "Zeta" }),
    makeBook({ id: "volume-2", title: "Second", volume_number: 2 }),
    makeBook({ id: "unknown-a", title: "Alpha" }),
    makeBook({ id: "volume-1", title: "First", volume_number: 1 }),
  ]);

  assert.deepEqual(sorted.map((book) => book.id), [
    "volume-1",
    "volume-2",
    "unknown-a",
    "unknown-b",
  ]);
});

test("builds series banner metadata from all books", () => {
  const books = [
    makeBook({ authors: ["Robin Hobb"], genres: ["Fantasy"], rating: 5 }),
    makeBook({ id: "two", authors: ["Robin Hobb", "Editor"], genres: ["Fantasy", "Drama"], rating: 3 }),
    makeBook({ id: "three", authors: ["Editor"], genres: ["Drama"] }),
  ];

  assert.deepEqual(getSeriesAuthors(books), ["Editor", "Robin Hobb"]);
  assert.equal(getMostCommonGenre(books), "Drama");
  assert.equal(getAverageSeriesRating(books), 4);
});

test("calculates page-based progress with finished books full and reading or DNF pages recorded", () => {
  const progress = getSeriesProgress([
    makeBook({ status: "Finished", current_page: 1, total_pages: 100 }),
    makeBook({ id: "reading", status: "Reading", current_page: 50, total_pages: 100 }),
    makeBook({ id: "dnf", status: "DNF", current_page: 25, total_pages: 100 }),
    makeBook({ id: "next", status: "Up Next", current_page: 80, total_pages: 100 }),
  ]);

  assert.deepEqual(progress, {
    isAvailable: true,
    percentage: 44,
    readPages: 175,
    totalPages: 400,
    finishedBooks: 1,
  });
});

test("marks page-based progress unavailable when a series volume has no total pages", () => {
  const progress = getSeriesProgress([
    makeBook({ status: "Finished", total_pages: 100 }),
    makeBook({ id: "missing-pages", status: "Reading", current_page: 20 }),
  ]);

  assert.deepEqual(progress, {
    isAvailable: false,
    percentage: null,
    readPages: null,
    totalPages: null,
    finishedBooks: 1,
  });
});

test("chooses next up by series order rather than explicit up-next status", () => {
  const nextUp = getNextUpBook([
    makeBook({ id: "volume-3", status: "Up Next", volume_number: 3 }),
    makeBook({ id: "volume-1", status: "Finished", volume_number: 1 }),
    makeBook({ id: "volume-2", status: "To Read", volume_number: 2 }),
  ]);

  assert.equal(nextUp?.id, "volume-2");
});

test("gets latest activity and aggregated logs only from books in the series", () => {
  const books = [makeBook({ id: "volume-1" }), makeBook({ id: "volume-2" })];
  const logs = [
    makeLog({ id: "old", book_id: "volume-1", logged_at: "2026-05-01T12:00:00Z" }),
    makeLog({ id: "latest", book_id: "volume-2", logged_at: "2026-05-03T12:00:00Z" }),
    makeLog({ id: "other-series", book_id: "other", logged_at: "2026-05-04T12:00:00Z" }),
  ];

  assert.deepEqual(filterSeriesLogs(books, logs).map((log) => log.id), ["old", "latest"]);
  assert.equal(getLatestSeriesActivity(books, logs)?.book.id, "volume-2");
  assert.equal(getLatestSeriesActivity(books, logs)?.log.id, "latest");
});

test("builds journey dates from explicit book dates with reading log fallback", () => {
  const explicit = makeBook({
    status: "Finished",
    date_started: "2026-01-02",
    date_finished: "2026-01-08",
  });
  const logs = [
    makeLog({ logged_at: "2026-01-01T12:00:00Z", reading_time_minutes: 15 }),
    makeLog({ id: "last", logged_at: "2026-01-09T12:00:00Z", reading_time_minutes: 30 }),
  ];

  assert.deepEqual(getJourneyBookDates(explicit, logs), {
    started: "2026-01-02",
    finished: "2026-01-08",
  });
  assert.equal(getJourneyDurationDays(explicit, logs), 6);
  assert.equal(getBookReadingMinutes(explicit, logs), 45);

  const derived = makeBook({ status: "Finished" });
  assert.deepEqual(getJourneyBookDates(derived, logs), {
    started: "2026-01-01",
    finished: "2026-01-09",
  });

  const reading = makeBook({ status: "Reading", date_started: "2026-01-05" });
  assert.equal(getJourneyDurationDays(reading, [], new Date("2026-01-12T09:00:00")), 7);
});

test("builds journey recap with earliest favorite and highest-rated fallback", () => {
  const books = [
    makeBook({
      id: "one",
      volume_number: 1,
      status: "Finished",
      is_favorite: true,
      rating: 3,
      date_started: "2025-01-04",
      date_finished: "2025-01-29",
    }),
    makeBook({
      id: "two",
      volume_number: 2,
      status: "Finished",
      is_favorite: true,
      rating: 5,
      date_started: "2026-02-01",
      date_finished: "2026-03-04",
    }),
  ];

  const recap = getSeriesJourneyRecap(books, [
    makeLog({ book_id: "one", reading_time_minutes: 60 }),
    makeLog({ id: "second", book_id: "two", reading_time_minutes: 30 }),
  ]);
  assert.equal(recap.started, "2025-01-04");
  assert.equal(recap.timeSpentDays, 56);
  assert.equal(recap.finishedBooks, 2);
  assert.equal(recap.completedMonths, 14);
  assert.equal(recap.favoriteBook?.id, "one");

  const fallback = getSeriesJourneyRecap(
    books.map((book) => ({ ...book, is_favorite: false })),
    [],
  );
  assert.equal(fallback.favoriteBook?.id, "two");
});

test("only inserts immediate starts and breaks longer than ten days", () => {
  const previous = makeBook({
    status: "Finished",
    date_finished: "2026-01-10",
  });

  assert.deepEqual(
    getSeriesJourneyTransition(previous, makeBook({ date_started: "2026-01-11" }), []),
    { kind: "continued", days: 1, started: "2026-01-11" },
  );
  assert.equal(
    getSeriesJourneyTransition(previous, makeBook({ date_started: "2026-01-15" }), []),
    null,
  );
  assert.deepEqual(
    getSeriesJourneyTransition(previous, makeBook({ date_started: "2026-01-25" }), []),
    {
      kind: "break",
      days: 15,
      finished: "2026-01-10",
      started: "2026-01-25",
    },
  );
});

test("orders featured note candidates shortest first and prefers a favorite tie", () => {
  const ordered = getFeaturedNoteCandidates([
    makeNote({ id: "long", content: "A longer journal thought" }),
    makeNote({ id: "plain", content: "Short note" }),
    makeNote({ id: "favorite", content: "Short note", is_favorite: true }),
  ]);

  assert.deepEqual(ordered.map((note) => note.id), ["favorite", "plain", "long"]);
});

test("builds series stats overview using read pages, series logs, and active journey span", () => {
  const stats = getSeriesStats(
    [
      makeBook({
        id: "finished",
        status: "Finished",
        total_pages: 300,
        date_started: "2026-01-01",
        date_finished: "2026-01-11",
      }),
      makeBook({
        id: "reading",
        status: "Reading",
        total_pages: 200,
        current_page: 40,
        date_started: "2026-02-01",
      }),
      makeBook({ id: "to-read", status: "To Read", total_pages: 250 }),
    ],
    [
      makeLog({ id: "first", book_id: "finished", reading_time_minutes: 90 }),
      makeLog({ id: "second", book_id: "reading", reading_time_minutes: 45 }),
      makeLog({ id: "outside", book_id: "other", reading_time_minutes: 999 }),
    ],
    [],
    new Date("2026-02-15T09:00:00"),
  );

  assert.equal(stats.overview.finishedBooks, 1);
  assert.equal(stats.overview.totalBooks, 3);
  assert.equal(stats.overview.pagesRead, 340);
  assert.equal(stats.overview.readingMinutes, 135);
  assert.equal(stats.overview.journeyDays, 45);
  assert.deepEqual(stats.overview.journeySpan, { months: 1, weeks: 2, days: 0 });

  const completed = getSeriesStats(
    [
      makeBook({
        status: "Finished",
        date_started: "2026-01-01",
        date_finished: "2026-01-11",
        total_pages: 100,
      }),
    ],
    [],
    [],
    new Date("2026-04-01T09:00:00"),
  );
  assert.equal(completed.overview.journeyDays, 10);
});

test("calculates timing series stats from eligible books only", () => {
  const stats = getSeriesStats(
    [
      makeBook({
        id: "first",
        status: "Finished",
        rating: 4,
        date_started: "2026-01-01",
        date_finished: "2026-01-11",
      }),
      makeBook({
        id: "second",
        status: "Finished",
        rating: 2,
        date_started: "2026-01-12",
        date_finished: "2026-02-01",
      }),
      makeBook({ id: "unread", rating: null }),
    ],
    [],
    [],
  );

  assert.equal(stats.averageDaysPerBook, 15);
});

test("selects pace and length winners with ties while excluding missing inputs", () => {
  const stats = getSeriesStats(
    [
      makeBook({
        id: "a",
        volume_number: 1,
        status: "Finished",
        total_pages: 100,
        date_started: "2026-01-01",
        date_finished: "2026-01-06",
      }),
      makeBook({
        id: "b",
        volume_number: 2,
        status: "Finished",
        total_pages: 200,
        date_started: "2026-02-01",
        date_finished: "2026-02-06",
      }),
      makeBook({
        id: "d",
        volume_number: 3,
        status: "Finished",
        total_pages: 200,
        date_started: "2026-03-01",
        date_finished: "2026-03-11",
      }),
      makeBook({ id: "c", volume_number: 4, status: "Finished", total_pages: 300 }),
      makeBook({ id: "missing-pages", volume_number: 5, status: "Finished", date_started: "2026-04-01", date_finished: "2026-04-02" }),
    ],
    [],
    [],
  );

  assert.deepEqual(stats.fastestRead?.books.map((book) => book.id), ["b"]);
  assert.equal(stats.fastestRead?.value, 40);
  assert.deepEqual(stats.slowestRead?.books.map((book) => book.id), ["a", "d"]);
  assert.equal(stats.slowestRead?.value, 20);
  assert.deepEqual(stats.longestBook?.books.map((book) => book.id), ["c"]);
  assert.deepEqual(stats.shortestBook?.books.map((book) => book.id), ["a"]);
});

test("counts notes and quotes as annotations while excluding reviews", () => {
  const books = [
    makeBook({ id: "one", volume_number: 1, is_favorite: true, rating: 2 }),
    makeBook({ id: "two", volume_number: 2, is_favorite: true, rating: 5 }),
    makeBook({ id: "three", volume_number: 3, rating: 4 }),
  ];
  const notes = [
    makeNote({ id: "one-note", book_id: "one", label: "note" }),
    makeNote({ id: "one-review", book_id: "one", label: "review" }),
    makeNote({ id: "one-quote", book_id: "one", label: "quote" }),
    makeNote({ id: "two-quote", book_id: "two", label: "quote" }),
    makeNote({ id: "two-review", book_id: "two", label: "review" }),
    makeNote({ id: "outside", book_id: "outside", label: "note" }),
  ];

  const stats = getSeriesStats(books, [], notes);
  assert.deepEqual(stats.rankings.annotations.map((row) => row.book.id), ["one", "two"]);
  assert.deepEqual(stats.rankings.annotations.map((row) => row.value), [2, 1]);
});

test("builds rankings with favorite books first among equal ratings and includes only favorited series quotes", () => {
  const books = [
    makeBook({ id: "one", volume_number: 1, status: "Finished", rating: 3, total_pages: 100, date_started: "2026-01-01", date_finished: "2026-01-11" }),
    makeBook({ id: "two", volume_number: 2, status: "Finished", rating: 5, total_pages: 180, date_started: "2026-02-01", date_finished: "2026-02-11" }),
    makeBook({ id: "three", volume_number: 3, rating: 4 }),
    makeBook({ id: "favorite-five", volume_number: 4, rating: 5, is_favorite: true }),
  ];
  const notes = [
    makeNote({ id: "one-annotation", book_id: "one", label: "note" }),
    makeNote({ id: "two-review", book_id: "two", label: "review" }),
    makeNote({ id: "two-annotation", book_id: "two", label: "note" }),
    makeNote({ id: "favorite-one", book_id: "one", label: "quote", is_favorite: true, content: "First" }),
    makeNote({ id: "plain-quote", book_id: "one", label: "quote", content: "Not selected" }),
    makeNote({ id: "favorite-three", book_id: "three", label: "quote", is_favorite: true, content: "Third" }),
    makeNote({ id: "outside", book_id: "outside", label: "quote", is_favorite: true }),
  ];

  const stats = getSeriesStats(books, [], notes);

  assert.deepEqual(stats.rankings.rating.map((row) => row.book.id), ["favorite-five", "two", "three", "one"]);
  assert.deepEqual(stats.rankings.pace.map((row) => row.book.id), ["two", "one"]);
  assert.deepEqual(stats.rankings.annotations.map((row) => row.book.id), ["one", "two", "three"]);
  assert.deepEqual(stats.favoriteQuotes.map((entry) => entry.note.id), ["favorite-one", "favorite-three"]);
});

test("builds duration and pace chart rows in series order and excludes unusable pace data", () => {
  const stats = getSeriesStats(
    [
      makeBook({
        id: "volume-2",
        volume_number: 2,
        status: "Finished",
        date_started: "2026-02-01",
        date_finished: "2026-02-03",
      }),
      makeBook({
        id: "volume-1",
        volume_number: 1,
        status: "Finished",
        total_pages: 80,
        date_started: "2026-01-01",
        date_finished: "2026-01-05",
      }),
      makeBook({ id: "unread", volume_number: 3, total_pages: 100 }),
    ],
    [],
    [],
  );

  assert.deepEqual(stats.durationChart.map((row) => row.book.id), ["volume-1", "volume-2"]);
  assert.deepEqual(stats.durationChart.map((row) => row.days), [4, 2]);
  assert.deepEqual(stats.paceChart.map((row) => row.book.id), ["volume-1"]);
  assert.equal(stats.paceChart[0].pagesPerDay, 20);
});

test("keeps series stats neutral when required data is absent", () => {
  const empty = getSeriesStats([], [], []);
  assert.equal(empty.overview.pagesRead, 0);
  assert.equal(empty.overview.journeySpan, null);
  assert.deepEqual(empty.durationChart, []);
  assert.deepEqual(empty.paceChart, []);
  assert.deepEqual(empty.rankings, { rating: [], pace: [], annotations: [] });
  assert.deepEqual(empty.favoriteQuotes, []);

  const incomplete = getSeriesStats(
    [
      makeBook({ status: "Finished" }),
      makeBook({ id: "reading", status: "Reading" }),
    ],
    [],
    [],
  );
  assert.equal(incomplete.overview.pagesRead, null);
  assert.equal(incomplete.fastestRead, null);
  assert.equal(incomplete.longestBook, null);
});

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "volume",
    title: "Volume",
    authors: ["Author"],
    status: "To Read",
    rating: null,
    is_favorite: false,
    user_id: "user-1",
    created_at: "2026-05-01T08:00:00Z",
    ...overrides,
  };
}

function makeLog(overrides: Partial<ReadingLog>): ReadingLog {
  return {
    id: "log",
    book_id: "volume",
    user_id: "user-1",
    current_page: 10,
    logged_at: "2026-05-01T12:00:00Z",
    ...overrides,
  };
}

function makeNote(overrides: Partial<BookNote>): BookNote {
  return {
    id: "note",
    book_id: "volume",
    user_id: "user-1",
    label: "note",
    content: "Note",
    is_favorite: false,
    note_date: "2026-05-01",
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
    ...overrides,
  };
}
