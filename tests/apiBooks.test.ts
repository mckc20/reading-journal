import assert from "node:assert/strict";
import test from "node:test";
import type { VercelRequest } from "@vercel/node";
import {
  addAutomaticStatusDates,
  getBookId,
  getProgressPercent,
  getReadingLogBookUpdate,
  parseBookJournalPayload,
  parseBookListOptions,
  parseBookSearchQuery,
  parseBookUpdatePayload,
  parseReadingLogPayload,
  toApiBook,
} from "../api/_lib/books";

function requestWithQuery(query: Record<string, string | string[]>): VercelRequest {
  return { query } as VercelRequest;
}

test("uses a useful default book-list limit", () => {
  assert.deepEqual(parseBookListOptions(requestWithQuery({})), { status: null, limit: 50 });
});

test("accepts a known book status and caps an oversized limit", () => {
  assert.deepEqual(
    parseBookListOptions(requestWithQuery({ status: "Reading", limit: "500" })),
    { status: "Reading", limit: 100 },
  );
});

test("rejects invalid book-list filters", () => {
  assert.throws(() => parseBookListOptions(requestWithQuery({ status: "Archived" })), /status must be one of/);
  assert.throws(() => parseBookListOptions(requestWithQuery({ status: "" })), /status must be one of/);
  assert.throws(() => parseBookListOptions(requestWithQuery({ limit: "0" })), /positive whole number/);
  assert.throws(() => parseBookListOptions(requestWithQuery({ status: ["Reading", "Finished"] })), /only once/);
});

test("requires a non-empty trimmed book search query", () => {
  assert.equal(parseBookSearchQuery(requestWithQuery({ q: "  momo " })), "momo");
  assert.throws(() => parseBookSearchQuery(requestWithQuery({})), /q is required/);
  assert.throws(() => parseBookSearchQuery(requestWithQuery({ q: "  " })), /q is required/);
});

test("converts linked authors into the public API book shape", () => {
  assert.deepEqual(
    toApiBook({
      id: "book-id",
      title: "Momo",
      status: "Reading",
      current_page: 12,
      total_pages: 304,
      book_authors: [
        { position: 1, authors: { name: "Second author" } },
        { position: 0, authors: { name: "Michael Ende" } },
      ],
    }),
    {
      id: "book-id",
      title: "Momo",
      authors: ["Michael Ende", "Second author"],
      status: "Reading",
      current_page: 12,
      total_pages: 304,
    },
  );
});

test("reads valid dynamic book ids and treats malformed ids as not found", () => {
  assert.equal(
    getBookId(requestWithQuery({ id: "4d264b17-1dea-4fa9-b667-f981016f9a82" })),
    "4d264b17-1dea-4fa9-b667-f981016f9a82",
  );
  assert.equal(getBookId(requestWithQuery({ id: "not-a-book-id" })), null);
});

test("calculates bounded book progress or returns null without a total page count", () => {
  assert.equal(getProgressPercent(214, 240), 89);
  assert.equal(getProgressPercent(null, 240), 0);
  assert.equal(getProgressPercent(300, 240), 100);
  assert.equal(getProgressPercent(214, null), null);
});

test("parses only the allowed book update fields", () => {
  assert.deepEqual(
    parseBookUpdatePayload({
      status: "Reading",
      current_page: 48,
      rating: 4,
      date_started: "2026-07-23",
      date_finished: null,
      id: "another-book",
      user_id: "another-user",
      created_at: "2026-01-01T00:00:00Z",
    }),
    {
      status: "Reading",
      current_page: 48,
      rating: 4,
      date_started: "2026-07-23",
      date_finished: null,
    },
  );
});

test("rejects invalid book update input before it can reach the database", () => {
  assert.throws(() => parseBookUpdatePayload({ status: "Archived" }), /status must be one of/);
  assert.throws(() => parseBookUpdatePayload({ current_page: -1 }), /current_page must be/);
  assert.throws(() => parseBookUpdatePayload({ rating: 5.5 }), /rating must be/);
  assert.throws(() => parseBookUpdatePayload({ rating: 6 }), /rating must be/);
  assert.throws(() => parseBookUpdatePayload({ date_started: "23-07-2026" }), /date_started must use/);
  assert.throws(() => parseBookUpdatePayload([]), /Request body must be a JSON object/);
});

test("adds status dates only when the caller has not supplied an explicit date", () => {
  assert.deepEqual(
    addAutomaticStatusDates({ status: "Reading" }, { date_started: null, date_finished: null }, "2026-07-23"),
    { status: "Reading", date_started: "2026-07-23" },
  );
  assert.deepEqual(
    addAutomaticStatusDates({ status: "Finished" }, { date_started: null, date_finished: null }, "2026-07-23"),
    { status: "Finished", date_finished: "2026-07-23" },
  );
  assert.deepEqual(
    addAutomaticStatusDates(
      { status: "Reading", date_started: null },
      { date_started: null, date_finished: null },
      "2026-07-23",
    ),
    { status: "Reading", date_started: null },
  );
  assert.deepEqual(
    addAutomaticStatusDates(
      { status: "Finished" },
      { date_started: "2026-07-01", date_finished: null },
      "2026-07-23",
    ),
    { status: "Finished", date_finished: "2026-07-23" },
  );
});

test("parses a reading log with an optional session length and timestamp", () => {
  assert.deepEqual(parseReadingLogPayload({ current_page: 214 }), {
    current_page: 214,
    reading_time_minutes: null,
  });
  assert.deepEqual(
    parseReadingLogPayload({
      current_page: 214,
      reading_time_minutes: 0,
      logged_at: "2026-07-23T12:30:00.000Z",
    }),
    {
      current_page: 214,
      reading_time_minutes: 0,
      logged_at: "2026-07-23T12:30:00.000Z",
    },
  );
});

test("rejects invalid reading log input", () => {
  assert.throws(() => parseReadingLogPayload({}), /current_page is required/);
  assert.throws(() => parseReadingLogPayload({ current_page: -1 }), /current_page is required/);
  assert.throws(() => parseReadingLogPayload({ current_page: 3.5 }), /current_page is required/);
  assert.throws(() => parseReadingLogPayload({ current_page: 3, reading_time_minutes: -1 }), /reading_time_minutes must be/);
  assert.throws(() => parseReadingLogPayload({ current_page: 3, reading_time_minutes: null }), /reading_time_minutes must be/);
  assert.throws(() => parseReadingLogPayload({ current_page: 3, logged_at: "2026-07-23" }), /logged_at must be/);
});

test("advances reading progress and applies the matching status transitions", () => {
  assert.deepEqual(
    getReadingLogBookUpdate(
      { status: "To Read", current_page: 20, total_pages: 240, date_started: null, date_finished: null },
      48,
      "2026-07-23",
    ),
    { current_page: 48, status: "Reading", date_started: "2026-07-23" },
  );
  assert.deepEqual(
    getReadingLogBookUpdate(
      { status: "Reading", current_page: 214, total_pages: 240, date_started: "2026-07-01", date_finished: null },
      240,
      "2026-07-23",
    ),
    { current_page: 240, status: "Finished", date_finished: "2026-07-23" },
  );
  assert.deepEqual(
    getReadingLogBookUpdate(
      { status: "Reading", current_page: 214, total_pages: 240, date_started: "2026-07-01", date_finished: null },
      48,
      "2026-07-23",
    ),
    { current_page: 214 },
  );
  assert.deepEqual(
    getReadingLogBookUpdate(
      { status: "Paused", current_page: 48, total_pages: 240, date_started: "2026-07-01", date_finished: null },
      60,
      "2026-07-23",
    ),
    { current_page: 60, status: "Reading" },
  );
});

test("normalizes a book journal quote using the app's storage conventions", () => {
  assert.deepEqual(
    parseBookJournalPayload({
      label: "quote",
      content: "  Time is life itself.  ",
      quote_speaker: "  Michael Ende  ",
      page_start: 60,
      tags: ["time", " time ", "fantasy", ""],
      title: "Ignored for compatibility",
    }),
    {
      label: "quote",
      content: "Time is life itself.",
      quote_speaker: "Michael Ende",
      page_start: 60,
      tags: ["time", "fantasy"],
    },
  );
});

test("keeps speakers only for quotes and rejects invalid book journal input", () => {
  assert.deepEqual(
    parseBookJournalPayload({ label: "note", content: "A thought", quote_speaker: "Ignored" }),
    { label: "note", content: "A thought", quote_speaker: null, page_start: null, tags: null },
  );
  assert.throws(() => parseBookJournalPayload({ label: "scribble", content: "x" }), /label must be one of/);
  assert.throws(() => parseBookJournalPayload({ label: "note", content: "   " }), /content is required/);
  assert.throws(() => parseBookJournalPayload({ label: "note", content: "x", page_start: 0 }), /page_start must be/);
  assert.throws(() => parseBookJournalPayload({ label: "note", content: "x", tags: ["valid", 2] }), /tags must be/);
});
