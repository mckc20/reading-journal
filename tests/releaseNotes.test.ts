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

  assert.equal(entries[0].version, "2026-06-27-authors-normalization");
  assert.equal(entries[0].title, "Database-backed authors and author picker");
  assert.equal(entries[0].summary, "Authors now come from their own database table, and book forms use a searchable picker with inline author creation.");
  assert.equal(entries[0].highlights.length, 3);
  assert.equal(entries[0].highlights[0].title, "Author picker for books");
  assert.equal(entries[0].highlights[0].description, "You can now pick existing authors or open the Add Author dialog directly from the book form.");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
});
