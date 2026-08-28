import assert from "node:assert/strict";
import test from "node:test";
import type { VercelRequest } from "@vercel/node";
import {
  getBookId,
  getProgressPercent,
  parseBookListOptions,
  parseBookSearchQuery,
  toApiBook,
} from "../api/_lib/books";

function requestWithQuery(query: Record<string, string | string[]>): VercelRequest {
  return { query } as VercelRequest;
}

test("uses a useful default book-list limit", () => {
  assert.deepEqual(parseBookListOptions(requestWithQuery({})), { status: null, limit: 50 });
});

test("accepts a known book status and caps an oversized limit", () => {
  assert.deepEqual(
    parseBookListOptions(requestWithQuery({ status: "Reading", limit: "500" })),
    { status: "Reading", limit: 100 },
  );
});

test("rejects invalid book-list filters", () => {
  assert.throws(() => parseBookListOptions(requestWithQuery({ status: "Archived" })), /status must be one of/);
  assert.throws(() => parseBookListOptions(requestWithQuery({ status: "" })), /status must be one of/);
  assert.throws(() => parseBookListOptions(requestWithQuery({ limit: "0" })), /positive whole number/);
  assert.throws(() => parseBookListOptions(requestWithQuery({ status: ["Reading", "Finished"] })), /only once/);
});

test("requires a non-empty trimmed book search query", () => {
  assert.equal(parseBookSearchQuery(requestWithQuery({ q: "  momo " })), "momo");
  assert.throws(() => parseBookSearchQuery(requestWithQuery({})), /q is required/);
  assert.throws(() => parseBookSearchQuery(requestWithQuery({ q: "  " })), /q is required/);
});

test("converts linked authors into the public API book shape", () => {
  assert.deepEqual(
    toApiBook({
      id: "book-id",
      title: "Momo",
      status: "Reading",
      current_page: 12,
      total_pages: 304,
      book_authors: [
        { position: 1, authors: { name: "Second author" } },
        { position: 0, authors: { name: "Michael Ende" } },
      ],
    }),
    {
      id: "book-id",
      title: "Momo",
      authors: ["Michael Ende", "Second author"],
      status: "Reading",
      current_page: 12,
      total_pages: 304,
    },
  );
});

test("reads valid dynamic book ids and treats malformed ids as not found", () => {
  assert.equal(
    getBookId(requestWithQuery({ id: "4d264b17-1dea-4fa9-b667-f981016f9a82" })),
    "4d264b17-1dea-4fa9-b667-f981016f9a82",
  );
  assert.equal(getBookId(requestWithQuery({ id: "not-a-book-id" })), null);
});

test("calculates bounded book progress or returns null without a total page count", () => {
  assert.equal(getProgressPercent(214, 240), 89);
  assert.equal(getProgressPercent(null, 240), 0);
  assert.equal(getProgressPercent(300, 240), 100);
  assert.equal(getProgressPercent(214, null), null);
});
