import assert from "node:assert/strict";
import test from "node:test";
import { buildJournalBacklinks, getJournalEntryPublicId } from "../src/lib/journalEntryLookup";
import { bookJournalToJournalEntries } from "../src/lib/journal";
import type { BookJournalEntryRecord } from "../src/types";

function makeBookJournalEntryRecord(overrides: Partial<BookJournalEntryRecord> = {}): BookJournalEntryRecord {
  return {
    id: "note-1",
    public_id: "entry-one",
    user_id: "user-1",
    book_id: "book-1",
    label: "note",
    attribution: null,
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

test("reads a manual journal entry public id", () => {
  const [entry] = bookJournalToJournalEntries([makeBookJournalEntryRecord()]);
  assert.equal(getJournalEntryPublicId(entry), "entry-one");
});

test("builds backlinks by parsing journal protocol links from content", () => {
  const entries = bookJournalToJournalEntries([
    makeBookJournalEntryRecord({ id: "target", public_id: "target-public", content: "Target entry" }),
    makeBookJournalEntryRecord({
      id: "source",
      public_id: "source-public",
      content: "This reminds me of [that thought](journal://entry/target-public).",
      entry_date: "2026-07-02",
    }),
    makeBookJournalEntryRecord({
      id: "external",
      public_id: "external-public",
      content: "[External](https://example.com)",
      entry_date: "2026-07-03",
    }),
  ]);

  const backlinks = buildJournalBacklinks(entries, "target-public");

  assert.equal(backlinks.length, 1);
  assert.equal(backlinks[0].publicId, "source-public");
  assert.equal(backlinks[0].href, "/journal/source-public");
});
