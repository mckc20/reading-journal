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

  assert.equal(entries[0].version, "2026-06-21-pause-books");
  assert.equal(entries[0].title, "Chat, groups, attachments, and pause mode");
  assert.equal(entries[0].summary, "You can now chat with other readers, organize conversations into groups, share attachments, and pause books when you need to step away.");
  assert.equal(entries[0].highlights.length, 3);
  assert.equal(entries[0].highlights[0].title, "Direct chats and group spaces");
  assert.equal(entries[0].highlights[0].description, "Start one-to-one conversations or create shared spaces for reading clubs and friends.");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
});
