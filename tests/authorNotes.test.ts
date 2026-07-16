import assert from "node:assert/strict";
import test from "node:test";
import {
  authorNoteErrorToError,
  normalizeAuthorNoteFields,
  normalizeAuthorNoteInput,
  sortAuthorNotes,
} from "../src/lib/authorNotes";
import type { AuthorNote } from "../src/types";

function makeAuthorNote(overrides: Partial<AuthorNote> = {}): AuthorNote {
  return {
    id: "author-note-1",
    user_id: "user-1",
    author_id: "author-1",
    label: "note",
    title: null,
    quote_speaker: null,
    content: "An author note",
    page_start: null,
    is_favorite: false,
    note_date: "2026-07-01",
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-01T08:30:00.000Z",
    ...overrides,
  };
}

test("normalizes author note fields", () => {
  assert.deepEqual(
    normalizeAuthorNoteInput({
      authorId: "author-1",
      userId: "user-1",
      title: "  Background  ",
      content: "  This belongs to the author.  ",
      noteDate: "2026-07-02",
    }),
    {
      author_id: "author-1",
      user_id: "user-1",
      label: "note",
      title: "Background",
      quote_speaker: null,
      content: "This belongs to the author.",
      page_start: null,
      is_favorite: false,
      note_date: "2026-07-02",
    },
  );
});

test("normalizes author quotes with speaker and page", () => {
  assert.deepEqual(
    normalizeAuthorNoteInput({
      authorId: "author-1",
      userId: "user-1",
      label: "quote",
      title: "Ignored title",
      quoteSpeaker: "  Narrator  ",
      content: "  A quote about the author.  ",
      pageStart: "42",
      noteDate: "2026-07-02",
    }),
    {
      author_id: "author-1",
      user_id: "user-1",
      label: "quote",
      title: null,
      quote_speaker: "Narrator",
      content: "A quote about the author.",
      page_start: 42,
      is_favorite: false,
      note_date: "2026-07-02",
    },
  );
});

test("stores blank author note title as null", () => {
  assert.equal(
    normalizeAuthorNoteFields({
      title: "   ",
      content: "A note",
      noteDate: "2026-07-02",
    }).title,
    null,
  );
});

test("rejects blank author note content", () => {
  assert.throws(
    () =>
      normalizeAuthorNoteFields({
        title: "Optional",
        content: "   ",
        noteDate: "2026-07-02",
      }),
    /Note content is required/,
  );
});

test("sorts author notes by visible date newest first", () => {
  const notes = [
    makeAuthorNote({ id: "older-created", note_date: "2026-07-01", created_at: "2026-07-02T08:00:00Z" }),
    makeAuthorNote({ id: "newer-date", note_date: "2026-07-03", created_at: "2026-07-01T08:00:00Z" }),
    makeAuthorNote({ id: "same-date-newer-created", note_date: "2026-07-01", created_at: "2026-07-03T08:00:00Z" }),
  ];

  assert.deepEqual(
    sortAuthorNotes(notes).map((note) => note.id),
    ["newer-date", "same-date-newer-created", "older-created"],
  );
});

test("converts Supabase-shaped author note errors to readable Error objects", () => {
  const error = authorNoteErrorToError({ message: "permission denied for table author_notes" });
  assert.equal(error.message, "permission denied for table author_notes");
});
