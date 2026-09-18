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

  assert.equal(entries[0].version, "2026-09-18-library-select-mode");
  assert.equal(entries[0].title, "Library Select mode");
  assert.equal(entries[0].summary, "Books, authors, and series now share a focused Select mode for managing multiple library items at once.");
  assert.equal(entries[0].highlights.length, 3);
  assert.equal(entries[0].highlights[0].title, "Consistent multi-select controls");
  assert.equal(entries[0].highlights[0].description, "Open Select mode from each library's three-dot menu, select items directly from the grid or list, and clearly see how many are selected.");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
});
