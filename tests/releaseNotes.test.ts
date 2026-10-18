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

  assert.equal(entries[0].version, "2026-10-18-wrap-ups-and-library-updates");
  assert.equal(entries[0].title, "Monthly wrap-ups and a refreshed library");
  assert.equal(entries[0].summary, "Revisit your reading with saved monthly wrap-ups, enjoy a consistent book design, and explore the latest Discover, Wishlist, and library improvements.");
  assert.equal(entries[0].highlights.length, 8);
  assert.equal(entries[0].highlights[0].title, "Your reading, remembered");
  assert.match(entries[0].highlights[0].description, /Saved wrap-ups keep the details recorded/);
  assert.equal(entries[0].highlights[3].title, "Personalized book discovery");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
  assert.equal(isUnreadReleaseNote("2026-10-03-discover-wishlist-library-management", latest.version), true);
});
