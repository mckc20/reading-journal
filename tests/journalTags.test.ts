import assert from "node:assert/strict";
import test from "node:test";
import { isInternalJournalTag, normalizeJournalTags, visibleJournalTags } from "../src/lib/journalTags";

test("normalizes journal tags by trimming blanks and deduplicating case-insensitively", () => {
  assert.deepEqual(normalizeJournalTags([" theme ", "Theme", "", "craft"]), ["theme", "craft"]);
});

test("detects internal journal tags", () => {
  assert.equal(isInternalJournalTag("__journal:reading-log:abc"), true);
  assert.equal(isInternalJournalTag("theme"), false);
});

test("hides internal journal tags from visible tags", () => {
  assert.deepEqual(visibleJournalTags(["theme", "__journal:generated-event:abc", "mood"]), ["theme", "mood"]);
});
