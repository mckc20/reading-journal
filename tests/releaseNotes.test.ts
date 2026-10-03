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

  assert.equal(entries[0].version, "2026-10-03-discover-wishlist-library-management");
  assert.equal(entries[0].title, "Discover, Wishlist, and library management");
  assert.equal(entries[0].summary, "Discover your next read, keep a simpler Wishlist, and manage books, authors, and series with more flexible actions.");
  assert.equal(entries[0].highlights.length, 5);
  assert.equal(entries[0].highlights[0].title, "Personalized book discovery");
  assert.equal(entries[0].highlights[0].description, "Discover recommendations with feedback, recommendation history, and suggestions for the next volumes in your series.");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
});
