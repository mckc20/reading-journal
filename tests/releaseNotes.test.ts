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

  assert.equal(entries[0].version, "2026-08-26-journal-entry-links");
  assert.equal(entries[0].title, "Journal entry links");
  assert.equal(entries[0].summary, "Journal entries can now reference other entries with simple internal links.");
  assert.equal(entries[0].highlights.length, 2);
  assert.equal(entries[0].highlights[0].title, "Internal journal links");
  assert.equal(entries[0].highlights[0].description, "Insert links to other journal entries while writing, and open them through stable journal URLs.");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
});
