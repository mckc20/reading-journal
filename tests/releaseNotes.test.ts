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

  assert.equal(entries[0].version, "2026-09-18-password-reset");
  assert.equal(entries[0].title, "Password reset");
  assert.equal(entries[0].summary, "You can now reset a forgotten password securely through an email link.");
  assert.equal(entries[0].highlights.length, 1);
  assert.equal(entries[0].highlights[0].title, "Password recovery by email");
  assert.equal(entries[0].highlights[0].description, "Request a reset link from the sign-in screen, choose a new password, then sign in again.");
  assert.equal(entries[entries.length - 1].version, "2026-04-21-usual-time-metrics");
});

test("keeps unread state tied to the latest release note only", () => {
  const entries = parseChangelogMarkdown(changelogMarkdown);
  const latest = entries[0];

  assert.equal(isUnreadReleaseNote(latest.version, latest.version), false);
  assert.equal(isUnreadReleaseNote("older-version", latest.version), true);
});
