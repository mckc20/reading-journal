import assert from "node:assert/strict";
import test from "node:test";
import {
  applyJournalEntryLinkToMarkdown,
  extractJournalEntryPublicIds,
  findMarkdownLinkAtSelection,
  journalHrefForPublicId,
  removeMarkdownLink,
  type JournalLinkTarget,
} from "../src/lib/journalLinks";

const target: JournalLinkTarget = {
  id: "entry-1",
  publicId: "a8f4d2",
  label: "Earlier thought",
  description: "Page 12",
  href: "journal://entry/a8f4d2",
};

test("wraps selected text in a journal entry markdown link", () => {
  const result = applyJournalEntryLinkToMarkdown("This mattered today", 5, 13, target);

  assert.equal(result.markdown, "This [mattered](journal://entry/a8f4d2) today");
  assert.deepEqual(result.selection, { start: 39, end: 39 });
});

test("uses the entry label when no text is selected", () => {
  const result = applyJournalEntryLinkToMarkdown("Read this: ", 11, 11, target);

  assert.equal(result.markdown, "Read this: [Earlier thought](journal://entry/a8f4d2)");
});

test("finds and removes a markdown link at the cursor", () => {
  const markdown = "This [mattered](journal://entry/a8f4d2) today";
  const link = findMarkdownLinkAtSelection(markdown, 10);

  assert.ok(link);
  assert.equal(link.text, "mattered");
  assert.equal(link.href, "journal://entry/a8f4d2");

  const result = removeMarkdownLink(markdown, link);
  assert.equal(result.markdown, "This mattered today");
  assert.deepEqual(result.selection, { start: 13, end: 13 });
});

test("builds journal protocol hrefs from public ids", () => {
  assert.equal(journalHrefForPublicId("a8f4d2"), "journal://entry/a8f4d2");
});

test("extracts unique journal entry public ids from markdown links", () => {
  assert.deepEqual(
    extractJournalEntryPublicIds([
      "[Earlier](journal://entry/a8f4d2)",
      "[Again](journal://entry/a8f4d2)",
      "[Later](journal://entry/b7c9e1)",
      "[External](https://example.com)",
      "[Bad](journal://book/a8f4d2)",
    ].join("\n")),
    ["a8f4d2", "b7c9e1"],
  );
});
