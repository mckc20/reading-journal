import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSeriesJournalEntryRecordFields,
  normalizeSeriesJournalEntryRecordInput,
  seriesJournalEntryErrorToError,
  sortSeriesJournalEntryRecords,
} from "../src/lib/seriesJournal";
import type { SeriesJournalEntryRecord } from "../src/types";

function makeSeriesJournalEntryRecord(overrides: Partial<SeriesJournalEntryRecord> = {}): SeriesJournalEntryRecord {
  return {
    id: "series-note-1",
    user_id: "user-1",
    series_id: "series-1",
    label: "note",
    attribution: null,
    content: "A series note",
    page_start: null,
    is_favorite: false,
    entry_date: "2026-07-01",
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-01T08:30:00.000Z",
    ...overrides,
  };
}

test("normalizes series note fields", () => {
  assert.deepEqual(
    normalizeSeriesJournalEntryRecordInput({
      seriesId: "series-1",
      userId: "user-1",
      content: "  This belongs to the whole series.  ",
      noteDate: "2026-07-02",
    }),
    {
      series_id: "series-1",
      user_id: "user-1",
      label: "note",
      attribution: null,
      content: "This belongs to the whole series.",
      page_start: null,
      is_favorite: false,
      entry_date: "2026-07-02",
    },
  );
});

test("includes parent entry id for series journal replies", () => {
  assert.equal(
    normalizeSeriesJournalEntryRecordInput({
      seriesId: "series-1",
      userId: "user-1",
      content: "A reply",
      parentEntryId: "parent-1",
    }).parent_entry_id,
    "parent-1",
  );
});

test("normalizes series quotes with attribution and page", () => {
  assert.deepEqual(
    normalizeSeriesJournalEntryRecordInput({
      seriesId: "series-1",
      userId: "user-1",
      label: "quote",
      attribution: "  Narrator  ",
      content: "  A quote for the whole series.  ",
      pageStart: "42",
      noteDate: "2026-07-02",
    }),
    {
      series_id: "series-1",
      user_id: "user-1",
      label: "quote",
      attribution: "Narrator",
      content: "A quote for the whole series.",
      page_start: 42,
      is_favorite: false,
      entry_date: "2026-07-02",
    },
  );
});

test("series thoughts do not persist attribution", () => {
  assert.equal(
    normalizeSeriesJournalEntryRecordFields({
      attribution: "Should not save",
      content: "A note",
      noteDate: "2026-07-02",
    }).attribution,
    null,
  );
});

test("rejects blank series note content", () => {
  assert.throws(
    () =>
      normalizeSeriesJournalEntryRecordFields({
        content: "   ",
        noteDate: "2026-07-02",
      }),
    /Note content is required/,
  );
});

test("sorts series journalEntries by visible date newest first", () => {
  const journalEntries = [
    makeSeriesJournalEntryRecord({ id: "older-created", entry_date: "2026-07-01", created_at: "2026-07-02T08:00:00Z" }),
    makeSeriesJournalEntryRecord({ id: "newer-date", entry_date: "2026-07-03", created_at: "2026-07-01T08:00:00Z" }),
    makeSeriesJournalEntryRecord({ id: "same-date-newer-created", entry_date: "2026-07-01", created_at: "2026-07-03T08:00:00Z" }),
  ];

  assert.deepEqual(
    sortSeriesJournalEntryRecords(journalEntries).map((note) => note.id),
    ["newer-date", "same-date-newer-created", "older-created"],
  );
});

test("converts Supabase-shaped series note errors to readable Error objects", () => {
  const error = seriesJournalEntryErrorToError({ message: "permission denied for table series_journal" });
  assert.equal(error.message, "permission denied for table series_journal");
});
