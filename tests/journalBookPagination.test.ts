import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateJournalBookEntryWeight,
  paginateJournalBookEntries,
  type JournalBookPaginationItem,
} from "../src/lib/journalBookPagination";

function makeItem(overrides: Partial<JournalBookPaginationItem> = {}): JournalBookPaginationItem {
  return {
    id: "entry-1",
    content: "A short journal entry.",
    tagCount: 0,
    hasAttribution: false,
    childCount: 0,
    ...overrides,
  };
}

test("returns no pages for no entries", () => {
  assert.deepEqual(paginateJournalBookEntries([]), []);
});

test("keeps entries in deterministic order", () => {
  const pages = paginateJournalBookEntries([
    makeItem({ id: "entry-1" }),
    makeItem({ id: "entry-2" }),
    makeItem({ id: "entry-3" }),
  ]);

  assert.deepEqual(pages.flatMap((page) => page.entries.map((entry) => entry.id)), [
    "entry-1",
    "entry-2",
    "entry-3",
  ]);
});

test("moves a full entry to the next page when it would overflow", () => {
  const pages = paginateJournalBookEntries([
    makeItem({ id: "entry-1", content: "x ".repeat(260) }),
    makeItem({ id: "entry-2", content: "x ".repeat(260) }),
    makeItem({ id: "entry-3", content: "x ".repeat(260) }),
  ], { pageCapacity: 20 });

  assert.equal(pages.length, 3);
  assert.deepEqual(pages.map((page) => page.entries.map((entry) => entry.id)), [
    ["entry-1"],
    ["entry-2"],
    ["entry-3"],
  ]);
});

test("splits an extremely long entry across several pages", () => {
  const pages = paginateJournalBookEntries([
    makeItem({ id: "long-entry", content: "x ".repeat(2500) }),
    makeItem({ id: "short-entry" }),
  ], { pageCapacity: 24 });

  const longEntrySegments = pages.flatMap((page) => page.entries).filter((entry) => entry.originalId === "long-entry");

  assert.ok(longEntrySegments.length > 1);
  assert.equal(longEntrySegments[0].isContinuation, false);
  assert.equal(longEntrySegments[1].isContinuation, true);
  assert.equal(pages.flatMap((page) => page.entries).at(-1)?.originalId, "short-entry");
});

test("uses remaining page space when splitting long content after a short paragraph", () => {
  const pages = paginateJournalBookEntries([
    makeItem({ id: "long-entry", content: `Short opening paragraph.\n\n${"x ".repeat(1000)}` }),
  ], { pageCapacity: 24 });

  assert.ok(pages.length > 1);
  assert.ok(pages[0].weight > 18);
});

test("starts forced page items at the top of a new page", () => {
  const pages = paginateJournalBookEntries([
    makeItem({ id: "entry-1", content: "x ".repeat(160) }),
    makeItem({ id: "new-date-entry", content: "New date.", forceNewPage: true, headingWeight: 3 }),
  ], { pageCapacity: 24 });

  assert.equal(pages.length, 2);
  assert.deepEqual(pages[1].entries.map((entry) => entry.id), ["new-date-entry"]);
});

test("keeps split entry text in order without dropping words", () => {
  const words = Array.from({ length: 400 }, (_, index) => `word${index + 1}`);
  const content = words.join(" ");
  const pages = paginateJournalBookEntries([
    makeItem({ id: "long-entry", content }),
  ], { pageCapacity: 18 });
  const splitText = pages.flatMap((page) => page.entries).map((entry) => entry.content).join("");

  assert.equal(splitText.replace(/\s+/g, " ").trim(), content);
});

test("metadata increases estimated entry weight", () => {
  const plainWeight = estimateJournalBookEntryWeight(makeItem());
  const metadataWeight = estimateJournalBookEntryWeight(makeItem({
    tagCount: 2,
    hasAttribution: true,
    childCount: 1,
  }));

  assert.ok(metadataWeight > plainWeight);
});
