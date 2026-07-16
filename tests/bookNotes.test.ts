import assert from "node:assert/strict";
import test from "node:test";
import {
  bookNoteErrorToError,
  formatBookNotePageRange,
  getProgressNoteDate,
  normalizeBookNoteFields,
  normalizeBookNoteInput,
  sortBookNotes,
} from "../src/lib/bookNotes";
import type { BookNote } from "../src/types";

test("normalizes book note title and content before insert", () => {
  assert.deepEqual(
    normalizeBookNoteInput({
      bookId: "book-1",
      userId: "user-1",
      label: "quote",
      title: "  Favorite line  ",
      quoteSpeaker: "  Mae Holland  ",
      content: "  This stayed with me.  ",
      noteDate: "2026-05-05",
      isFavorite: true,
    }),
    {
      book_id: "book-1",
      user_id: "user-1",
      label: "quote",
      title: null,
      quote_speaker: "Mae Holland",
      content: "This stayed with me.",
      page_start: null,
      is_favorite: true,
      note_date: "2026-05-05",
    },
  );
});

test("stores blank book note title as null", () => {
  assert.equal(
    normalizeBookNoteInput({
      bookId: "book-1",
      userId: "user-1",
      label: "note",
      title: "   ",
      content: "A regular note",
    }).title,
    null,
  );
});

test("rejects blank book note content", () => {
  assert.throws(
    () =>
      normalizeBookNoteInput({
        bookId: "book-1",
        userId: "user-1",
        label: "review",
        content: "   ",
      }),
    /Note content is required/,
  );
});

test("normalizes editable book note fields", () => {
  assert.deepEqual(
    normalizeBookNoteFields({
      label: "review",
      title: "  Final thoughts  ",
      quoteSpeaker: "Should not save",
      content: "  Strong ending.  ",
      noteDate: "2026-04-30",
    }),
    {
      label: "review",
      title: "Final thoughts",
      quote_speaker: null,
      content: "Strong ending.",
      page_start: null,
      is_favorite: false,
      note_date: "2026-04-30",
    },
  );
});

test("normalizes a single source page", () => {
  assert.deepEqual(
    normalizeBookNoteFields({
      label: "quote",
      content: "Important line.",
      pageStart: "42",
      noteDate: "2026-05-01",
    }),
    {
      label: "quote",
      title: null,
      quote_speaker: null,
      content: "Important line.",
      page_start: 42,
      is_favorite: false,
      note_date: "2026-05-01",
    },
  );
});

test("normalizes saved state for quote entries", () => {
  assert.deepEqual(
    normalizeBookNoteFields({
      label: "quote",
      content: "Favorite line.",
      quoteSpeaker: "Annie",
      isFavorite: true,
      noteDate: "2026-05-02",
    }),
    {
      label: "quote",
      title: null,
      quote_speaker: "Annie",
      content: "Favorite line.",
      page_start: null,
      is_favorite: true,
      note_date: "2026-05-02",
    },
  );
});

test("stores saved state for reviews and regular notes", () => {
  assert.equal(
    normalizeBookNoteFields({
      label: "review",
      content: "Thoughts.",
      isFavorite: true,
      noteDate: "2026-05-03",
    }).is_favorite,
    true,
  );
});

test("stores quote speaker only for quote entries", () => {
  assert.equal(
    normalizeBookNoteFields({
      label: "quote",
      content: "Quoted text.",
      quoteSpeaker: "  Mae  ",
      noteDate: "2026-05-04",
    }).quote_speaker,
    "Mae",
  );

  assert.equal(
    normalizeBookNoteFields({
      label: "note",
      content: "Regular thought.",
      quoteSpeaker: "Mae",
      noteDate: "2026-05-04",
    }).quote_speaker,
    null,
  );
});

test("omits blank tags from new book note inserts", () => {
  const payload = normalizeBookNoteInput({
    bookId: "book-1",
    userId: "user-1",
    label: "note",
    content: "A regular note",
    tags: [" ", ""],
  });

  assert.equal("tags" in payload, false);
});

test("includes normalized tags when new book notes have tags", () => {
  assert.deepEqual(
    normalizeBookNoteInput({
      bookId: "book-1",
      userId: "user-1",
      label: "note",
      content: "A regular note",
      tags: ["  theme  ", "theme", "craft"],
    }).tags,
    ["theme", "craft"],
  );
});

test("omits tags from editable fields when tags are not provided", () => {
  const payload = normalizeBookNoteFields({
    label: "note",
    content: "A regular note",
  });

  assert.equal("tags" in payload, false);
});

test("clears editable tags when an empty tag list is explicitly provided", () => {
  assert.equal(
    normalizeBookNoteFields({
      label: "note",
      content: "A regular note",
      tags: [],
    }).tags,
    null,
  );
});

test("converts Supabase-shaped note errors to readable Error objects", () => {
  const error = bookNoteErrorToError({
    message: "Could not find the 'tags' column of 'book_notes' in the schema cache",
  });

  assert.equal(error.message, "Could not find the 'tags' column of 'book_notes' in the schema cache");
});

test("formats source page labels", () => {
  assert.equal(formatBookNotePageRange({ page_start: null }), null);
  assert.equal(formatBookNotePageRange({ page_start: 42 }), "p. 42");
});

test("uses the selected progress date for notes created from progress updates", () => {
  assert.equal(getProgressNoteDate(true, "2026-05-05T23:45"), "2026-05-05");
});

test("lets progress notes default to today when no progress date is edited", () => {
  assert.equal(getProgressNoteDate(false, "2026-05-05T23:45"), null);
  assert.equal(getProgressNoteDate(true, ""), null);
});

test("sorts notes by visible note date newest first", () => {
  const notes = [
    makeBookNote({ id: "older-created", note_date: "2026-05-01", created_at: "2026-05-02T08:00:00Z" }),
    makeBookNote({ id: "newer-date", note_date: "2026-05-03", created_at: "2026-05-01T08:00:00Z" }),
    makeBookNote({ id: "same-date-newer-created", note_date: "2026-05-01", created_at: "2026-05-03T08:00:00Z" }),
  ];

  assert.deepEqual(
    sortBookNotes(notes).map((note) => note.id),
    ["newer-date", "same-date-newer-created", "older-created"],
  );
});

function makeBookNote(overrides: Partial<BookNote>): BookNote {
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
