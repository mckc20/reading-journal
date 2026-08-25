import assert from "node:assert/strict";
import test from "node:test";
import {
  applyJournalEntryLinkToMarkdown,
  findMarkdownLinkAtSelection,
  removeMarkdownLink,
  type JournalLinkTarget,
} from "../src/lib/journalLinks";

const target: JournalLinkTarget = {
  id: "entry-1",
  label: "Earlier thought",
  description: "Page 12",
  href: "/books/book-1/journal?entry=entry-1",
};

test("wraps selected text in a journal entry markdown link", () => {
  const result = applyJournalEntryLinkToMarkdown("This mattered today", 5, 13, target);

  assert.equal(result.markdown, "This [mattered](/books/book-1/journal?entry=entry-1) today");
  assert.deepEqual(result.selection, { start: 52, end: 52 });
});

test("uses the entry label when no text is selected", () => {
  const result = applyJournalEntryLinkToMarkdown("Read this: ", 11, 11, target);

  assert.equal(result.markdown, "Read this: [Earlier thought](/books/book-1/journal?entry=entry-1)");
});

test("finds and removes a markdown link at the cursor", () => {
  const markdown = "This [mattered](/books/book-1/journal?entry=entry-1) today";
  const link = findMarkdownLinkAtSelection(markdown, 10);

  assert.ok(link);
  assert.equal(link.text, "mattered");
  assert.equal(link.href, "/books/book-1/journal?entry=entry-1");

  const result = removeMarkdownLink(markdown, link);
  assert.equal(result.markdown, "This mattered today");
  assert.deepEqual(result.selection, { start: 13, end: 13 });
});
