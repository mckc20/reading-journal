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

  assert.equal(entries[0].version, "2026-07-05-series-detail-analytics");
  assert.equal(entries[0].title, "Series detail and analytics redesign");
  assert.equal(entries[0].summary, "Series pages now feel more complete, with a redesigned detail page, dedicated subpages, richer analytics, and better recommendations.");
  assert.equal(entries[0].highlights.length, 4);
  assert.equal(entries[0].highlights[0].title, "Redesigned series detail page");
  assert.equal(entries[0].highlights[0].description, "Series pages now have a stronger hero, editable banner support, polished progress cards, focused book and quote sections, and a cleaner More to Explore area.");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
});
