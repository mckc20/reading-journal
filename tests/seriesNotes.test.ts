import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSeriesNoteFields,
  normalizeSeriesNoteInput,
  seriesNoteErrorToError,
  sortSeriesNotes,
} from "../src/lib/seriesNotes";
import type { SeriesNote } from "../src/types";

function makeSeriesNote(overrides: Partial<SeriesNote> = {}): SeriesNote {
  return {
    id: "series-note-1",
    user_id: "user-1",
    series_id: "series-1",
    label: "note",
    title: null,
    quote_speaker: null,
    content: "A series note",
    page_start: null,
    is_favorite: false,
    note_date: "2026-07-01",
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-01T08:30:00.000Z",
    ...overrides,
  };
}

test("normalizes series note fields", () => {
  assert.deepEqual(
    normalizeSeriesNoteInput({
      seriesId: "series-1",
      userId: "user-1",
      title: "  Big thought  ",
      content: "  This belongs to the whole series.  ",
      noteDate: "2026-07-02",
    }),
    {
      series_id: "series-1",
      user_id: "user-1",
      label: "note",
      title: "Big thought",
      quote_speaker: null,
      content: "This belongs to the whole series.",
      page_start: null,
      is_favorite: false,
      note_date: "2026-07-02",
    },
  );
});

test("normalizes series quotes with speaker and page", () => {
  assert.deepEqual(
    normalizeSeriesNoteInput({
      seriesId: "series-1",
      userId: "user-1",
      label: "quote",
      title: "Ignored title",
      quoteSpeaker: "  Narrator  ",
      content: "  A quote for the whole series.  ",
      pageStart: "42",
      noteDate: "2026-07-02",
    }),
    {
      series_id: "series-1",
      user_id: "user-1",
      label: "quote",
      title: null,
      quote_speaker: "Narrator",
      content: "A quote for the whole series.",
      page_start: 42,
      is_favorite: false,
      note_date: "2026-07-02",
    },
  );
});

test("stores blank series note title as null", () => {
  assert.equal(
    normalizeSeriesNoteFields({
      title: "   ",
      content: "A note",
      noteDate: "2026-07-02",
    }).title,
    null,
  );
});

test("rejects blank series note content", () => {
  assert.throws(
    () =>
      normalizeSeriesNoteFields({
        title: "Optional",
        content: "   ",
        noteDate: "2026-07-02",
      }),
    /Note content is required/,
  );
});

test("sorts series notes by visible date newest first", () => {
  const notes = [
    makeSeriesNote({ id: "older-created", note_date: "2026-07-01", created_at: "2026-07-02T08:00:00Z" }),
    makeSeriesNote({ id: "newer-date", note_date: "2026-07-03", created_at: "2026-07-01T08:00:00Z" }),
    makeSeriesNote({ id: "same-date-newer-created", note_date: "2026-07-01", created_at: "2026-07-03T08:00:00Z" }),
  ];

  assert.deepEqual(
    sortSeriesNotes(notes).map((note) => note.id),
    ["newer-date", "same-date-newer-created", "older-created"],
  );
});

test("converts Supabase-shaped series note errors to readable Error objects", () => {
  const error = seriesNoteErrorToError({ message: "permission denied for table series_notes" });
  assert.equal(error.message, "permission denied for table series_notes");
});
