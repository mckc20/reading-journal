import assert from "node:assert/strict";
import test from "node:test";
import {
  authorJournalToJournalEntries,
  authorJournalEntryToJournalEntry,
  bookJournalEntryLabelToJournalEntryType,
  bookJournalToJournalEntries,
  bookJournalEntryToJournalEntry,
  buildGeneratedBookJournalEntries,
  buildGeneratedAuthorJournalEntries,
  buildGeneratedSeriesJournalEntries,
  seriesJournalToJournalEntries,
  seriesJournalEntryToJournalEntry,
  sortJournalEntries,
} from "../src/lib/journal";
import type { AuthorJournalEntryRecord, Book, BookJournalEntryRecord, JournalEntry, ReadingLog, SeriesJournalEntryRecord } from "../src/types";

function makeBookJournalEntryRecord(overrides: Partial<BookJournalEntryRecord> = {}): BookJournalEntryRecord {
  return {
    id: "note-1",
    user_id: "user-1",
    book_id: "book-1",
    label: "note",
    title: null,
    quote_speaker: null,
    content: "A note",
    tags: null,
    page_start: null,
    is_favorite: false,
    entry_date: "2026-07-01",
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-01T08:30:00.000Z",
    ...overrides,
  };
}

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-1",
    title: "Test Book",
    authors: ["Test Author"],
    status: "Reading",
    is_favorite: false,
    user_id: "user-1",
    created_at: "2026-06-01T08:00:00.000Z",
    ...overrides,
  };
}

function makeReadingLog(overrides: Partial<ReadingLog> = {}): ReadingLog {
  return {
    id: "log-1",
    book_id: "book-1",
    user_id: "user-1",
    current_page: 10,
    reading_time_minutes: 20,
    logged_at: "2026-07-01T08:00:00.000Z",
    ...overrides,
  };
}

function makeSeriesJournalEntryRecord(overrides: Partial<SeriesJournalEntryRecord> = {}): SeriesJournalEntryRecord {
  return {
    id: "series-note-1",
    user_id: "user-1",
    series_id: "series-1",
    label: "note",
    title: null,
    quote_speaker: null,
    content: "A series note",
    tags: null,
    page_start: null,
    is_favorite: false,
    entry_date: "2026-07-05",
    created_at: "2026-07-05T08:00:00.000Z",
    updated_at: "2026-07-05T08:30:00.000Z",
    ...overrides,
  };
}

function makeAuthorJournalEntryRecord(overrides: Partial<AuthorJournalEntryRecord> = {}): AuthorJournalEntryRecord {
  return {
    id: "author-note-1",
    user_id: "user-1",
    author_id: "author-1",
    label: "note",
    title: null,
    quote_speaker: null,
    content: "An author note",
    tags: null,
    page_start: null,
    is_favorite: false,
    entry_date: "2026-07-06",
    created_at: "2026-07-06T08:00:00.000Z",
    updated_at: "2026-07-06T08:30:00.000Z",
    ...overrides,
  };
}

test("maps book note labels to journal entry types", () => {
  assert.equal(bookJournalEntryLabelToJournalEntryType("note"), "thought");
  assert.equal(bookJournalEntryLabelToJournalEntryType("quote"), "passage");
  assert.equal(bookJournalEntryLabelToJournalEntryType("review"), "thought");
});

test("adapts a book note into the shared journal entry shape", () => {
  const note = makeBookJournalEntryRecord();
  const entry = bookJournalEntryToJournalEntry(note);

  assert.deepEqual(
    {
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      type: entry.type,
      source: entry.source,
      sourceId: entry.sourceId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
    {
      id: "book-note:note-1",
      entityType: "Book",
      entityId: "book-1",
      type: "thought",
      source: "book_note",
      sourceId: "note-1",
      createdAt: "2026-07-01",
      updatedAt: "2026-07-01T08:30:00.000Z",
    },
  );
  assert.equal(entry.bookJournalEntry, note);
});

test("adapts multiple book journalEntries without changing the source records", () => {
  const journalEntries = [
    makeBookJournalEntryRecord({ id: "note-1", label: "note" }),
    makeBookJournalEntryRecord({ id: "quote-1", label: "quote" }),
    makeBookJournalEntryRecord({ id: "review-1", label: "review" }),
  ];

  assert.deepEqual(
    bookJournalToJournalEntries(journalEntries).map((entry) => entry.type),
    ["thought", "passage", "thought"],
  );
  assert.equal(journalEntries[1].label, "quote");
});

test("adapts a series note into the shared journal entry shape", () => {
  const note = makeSeriesJournalEntryRecord();
  const entry = seriesJournalEntryToJournalEntry(note);

  assert.deepEqual(
    {
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      type: entry.type,
      source: entry.source,
      sourceId: entry.sourceId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
    {
      id: "series-note:series-note-1",
      entityType: "Series",
      entityId: "series-1",
      type: "thought",
      source: "series_note",
      sourceId: "series-note-1",
      createdAt: "2026-07-05",
      updatedAt: "2026-07-05T08:30:00.000Z",
    },
  );
  assert.equal(entry.seriesJournalEntry, note);
});

test("adapts an author note into the shared journal entry shape", () => {
  const note = makeAuthorJournalEntryRecord();
  const entry = authorJournalEntryToJournalEntry(note);

  assert.deepEqual(
    {
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      type: entry.type,
      source: entry.source,
      sourceId: entry.sourceId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
    {
      id: "author-note:author-note-1",
      entityType: "Author",
      entityId: "author-1",
      type: "thought",
      source: "author_note",
      sourceId: "author-note-1",
      createdAt: "2026-07-06",
      updatedAt: "2026-07-06T08:30:00.000Z",
    },
  );
  assert.equal(entry.authorJournalEntry, note);
});

test("sorts book, series, and author journal journalEntries together", () => {
  const entries = [
    ...bookJournalToJournalEntries([
      makeBookJournalEntryRecord({ id: "book-note", entry_date: "2026-07-01" }),
    ]),
    ...seriesJournalToJournalEntries([
      makeSeriesJournalEntryRecord({ id: "series-note", entry_date: "2026-07-02" }),
    ]),
    ...authorJournalToJournalEntries([
      makeAuthorJournalEntryRecord({ id: "author-note", entry_date: "2026-07-03" }),
    ]),
  ];

  assert.deepEqual(
    sortJournalEntries(entries).map((entry) => entry.id),
    ["author-note:author-note", "series-note:series-note", "book-note:book-note"],
  );
});

test("sorts note and passage entries together for a shared timeline", () => {
  const entries = bookJournalToJournalEntries([
    makeBookJournalEntryRecord({
      id: "older-note",
      label: "note",
      entry_date: "2026-07-01",
      updated_at: "2026-07-01T08:00:00.000Z",
    }),
    makeBookJournalEntryRecord({
      id: "newer-passage",
      label: "quote",
      entry_date: "2026-07-02",
      updated_at: "2026-07-02T08:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    sortJournalEntries(entries).map((entry) => [entry.sourceId, entry.type]),
    [
      ["newer-passage", "passage"],
        ["older-note", "thought"],
    ],
  );
});

test("sorts journalEntries, passages, and reviews together for a shared timeline", () => {
  const entries = bookJournalToJournalEntries([
    makeBookJournalEntryRecord({
      id: "old-note",
      label: "note",
      entry_date: "2026-07-01",
      updated_at: "2026-07-01T08:00:00.000Z",
    }),
    makeBookJournalEntryRecord({
      id: "new-review",
      label: "review",
      entry_date: "2026-07-03",
      updated_at: "2026-07-03T08:00:00.000Z",
    }),
    makeBookJournalEntryRecord({
      id: "middle-passage",
      label: "quote",
      entry_date: "2026-07-02",
      updated_at: "2026-07-02T08:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    sortJournalEntries(entries).map((entry) => [entry.sourceId, entry.type]),
    [
        ["new-review", "thought"],
      ["middle-passage", "passage"],
        ["old-note", "thought"],
    ],
  );
});

test("builds generated book journal entries from existing book and reading log data", () => {
  const book = makeBook({
    status: "Finished",
    total_pages: 400,
    date_started: "2026-07-01",
    date_finished: "2026-07-04",
    rating: 5,
  });
  const logs = [
    makeReadingLog({
      id: "log-100",
      current_page: 100,
      reading_time_minutes: 30,
      logged_at: "2026-07-01T12:00:00.000Z",
    }),
    makeReadingLog({
      id: "log-220",
      current_page: 220,
      reading_time_minutes: 45,
      logged_at: "2026-07-02T12:00:00.000Z",
    }),
    makeReadingLog({
      id: "log-400",
      current_page: 400,
      reading_time_minutes: 60,
      logged_at: "2026-07-04T12:00:00.000Z",
    }),
  ];

  const entries = buildGeneratedBookJournalEntries(book, logs);

  assert(entries.every((entry) => entry.source === "generated_book_event"));
  assert.deepEqual(
    entries
      .filter((entry) => entry.type === "reading_progress_milestone")
      .map((entry) => entry.metadata?.milestone)
      .sort((a, b) => (a ?? 0) - (b ?? 0)),
    [25, 50, 75, 100],
  );
  assert.equal(entries.filter((entry) => entry.type === "reading_session").length, 2);
  assert(entries.some((entry) => entry.type === "started_reading"));
  assert(entries.some((entry) => entry.type === "finished_reading"));
  assert(entries.some((entry) => entry.type === "rating_added" && entry.metadata?.rating === 5));
});

test("condenses reading sessions from the same day into one generated journal entry", () => {
  const book = makeBook({ total_pages: 400 });
  const entries = buildGeneratedBookJournalEntries(book, [
    makeReadingLog({
      id: "morning",
      current_page: 100,
      reading_time_minutes: 30,
      logged_at: "2026-07-01T08:00:00.000Z",
    }),
    makeReadingLog({
      id: "evening",
      current_page: 160,
      reading_time_minutes: 45,
      logged_at: "2026-07-01T20:00:00.000Z",
    }),
  ]);

  const readingSessions = entries.filter((entry) => entry.type === "reading_session");

  assert.equal(readingSessions.length, 1);
  assert.deepEqual(
    {
      label: readingSessions[0].label,
      description: readingSessions[0].description,
      currentPage: readingSessions[0].metadata?.currentPage,
      progressPercent: readingSessions[0].metadata?.progressPercent,
      readingMinutes: readingSessions[0].metadata?.readingMinutes,
      sessionCount: readingSessions[0].metadata?.sessionCount,
    },
    {
      label: "Reading sessions",
      description: "2 sessions over 1 day · 75 min total",
      currentPage: 160,
      progressPercent: 40,
      readingMinutes: 75,
      sessionCount: 2,
    },
  );
});

test("condenses reading sessions from consecutive days into one generated journal entry", () => {
  const book = makeBook({ total_pages: 400 });
  const entries = buildGeneratedBookJournalEntries(book, [
    makeReadingLog({
      id: "day-one",
      current_page: 80,
      reading_time_minutes: 30,
      logged_at: "2026-07-01T08:00:00.000Z",
    }),
    makeReadingLog({
      id: "day-two",
      current_page: 160,
      reading_time_minutes: 45,
      logged_at: "2026-07-02T20:00:00.000Z",
    }),
  ]);

  const readingSessions = entries.filter((entry) => entry.type === "reading_session");

  assert.equal(readingSessions.length, 1);
  assert.deepEqual(
    {
      description: readingSessions[0].description,
      currentPage: readingSessions[0].metadata?.currentPage,
      sessionCount: readingSessions[0].metadata?.sessionCount,
      sessions: readingSessions[0].metadata?.sessions?.map((session) => session.id),
    },
    {
      description: "2 sessions over 2 days · 75 min total",
      currentPage: 160,
      sessionCount: 2,
      sessions: ["day-one", "day-two"],
    },
  );
});

test("builds generated series entries from finished books and milestones", () => {
  const entries = buildGeneratedSeriesJournalEntries("series-1", [
    makeBook({ id: "book-1", title: "First", date_finished: "2026-07-01", volume_number: 1 }),
    makeBook({ id: "book-2", title: "Second", date_finished: "2026-07-03", volume_number: 2 }),
    makeBook({ id: "book-3", title: "Third", volume_number: 3 }),
  ]);

  assert(entries.every((entry) => entry.entityType === "Series"));
  assert.equal(entries.filter((entry) => entry.type === "finished_reading").length, 2);
  assert.deepEqual(
    entries
      .filter((entry) => entry.type === "reading_progress_milestone")
      .map((entry) => entry.metadata?.milestone)
      .sort((a, b) => (a ?? 0) - (b ?? 0)),
    [25, 50],
  );
});

test("builds generated author milestones every five finished books", () => {
  const books = Array.from({ length: 10 }, (_, index) =>
    makeBook({
      id: `book-${index + 1}`,
      title: `Book ${index + 1}`,
      date_finished: `2026-07-${String(index + 1).padStart(2, "0")}`,
    }),
  );

  const entries = buildGeneratedAuthorJournalEntries("Test Author", "author-1", books);

  assert.deepEqual(
    entries.map((entry) => [entry.entityType, entry.label, entry.metadata?.milestone]),
    [
      ["Author", "Read 10 books", 10],
      ["Author", "Read 5 books", 5],
    ],
  );
});

test("merges manual and generated journal entries in chronological order", () => {
  const manualEntries = bookJournalToJournalEntries([
    makeBookJournalEntryRecord({
      id: "manual-note",
      entry_date: "2026-07-02",
      updated_at: "2026-07-02T08:00:00.000Z",
    }),
  ]);
  const generatedEntries = buildGeneratedBookJournalEntries(
    makeBook({
      date_started: "2026-07-01",
      date_finished: "2026-07-03",
    }),
  );

  assert.deepEqual(
    sortJournalEntries([...manualEntries, ...generatedEntries]).map((entry) => entry.id),
    [
      "generated:book:book-1:finished-reading",
      "book-note:manual-note",
      "generated:book:book-1:started-reading",
    ],
  );
});

test("keeps note content on the source book note record", () => {
  const note = makeBookJournalEntryRecord({
    id: "note-with-content",
    title: "  A saved thought  ",
    content: "This is still stored on book_journal.",
  });
  const entry = bookJournalEntryToJournalEntry(note);

  assert.equal("content" in entry, false);
  assert.equal(entry.bookJournalEntry.content, "This is still stored on book_journal.");
});

test("sorts journal entries newest first with stable tie breakers", () => {
  const entries: JournalEntry[] = [
    {
      id: "book-note:a",
      entityType: "Book",
      entityId: "book-1",
      type: "note",
      source: "book_note",
      sourceId: "a",
      createdAt: "2026-07-01",
      updatedAt: "2026-07-01T08:00:00.000Z",
    },
    {
      id: "book-note:b",
      entityType: "Book",
      entityId: "book-1",
      type: "passage",
      source: "book_note",
      sourceId: "b",
      createdAt: "2026-07-02",
      updatedAt: "2026-07-02T08:00:00.000Z",
    },
    {
      id: "book-note:c",
      entityType: "Book",
      entityId: "book-1",
      type: "review",
      source: "book_note",
      sourceId: "c",
      createdAt: "2026-07-01",
      updatedAt: "2026-07-01T09:00:00.000Z",
    },
  ];

  assert.deepEqual(
    sortJournalEntries(entries).map((entry) => entry.id),
    ["book-note:b", "book-note:c", "book-note:a"],
  );
});
