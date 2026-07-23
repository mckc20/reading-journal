import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isUnreadReleaseNote, parseChangelogMarkdown } from "../src/lib/changelog";

const changelogMarkdown = readFileSync(
  resolve(process.cwd(), "src/content/changelog.md"),
  "utf8",
);

test("parses the changelog archive in reverse chronological order", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);

  assert.equal(entries[0].version, "2026-07-23-journal-pages");
  assert.equal(entries[0].title, "Journal pages for books, series, and authors");
  assert.equal(entries[0].summary, "Books, series, and authors now have dedicated journal pages for writing, reviewing, and organizing reading notes in one focused place.");
  assert.equal(entries[0].highlights.length, 4);
  assert.equal(entries[0].highlights[0].title, "Dedicated journal pages");
  assert.equal(entries[0].highlights[0].description, "Open a full journal view from book, series, and author pages instead of working only from smaller preview sections.");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
});
