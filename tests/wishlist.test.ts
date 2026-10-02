import assert from "node:assert/strict";
import test from "node:test";
import { findWishlistDuplicates, normalizedIsbn, normalizeWishlistText, wishlistCsv } from "../src/lib/wishlistLogic";

const base = { id: "wish", user_id: "user", title: "The Book", authors: ["A. Writer"], created_at: "", updated_at: "" };

test("normalizes ISBNs and identifies exact ISBN duplicates", () => {
  assert.equal(normalizedIsbn("978-1-234-X"), "9781234X");
  assert.equal(findWishlistDuplicates([{ ...base, isbn: "9781234X" }], { title: "Other", authors: ["Other"], isbn: "978-1-234-X" }).length, 1);
});

test("suspects a title and author duplicate while allowing another edition to be resolved by the UI", () => {
  const matches = findWishlistDuplicates([{ ...base, isbn: "one" }], { title: " the   book ", authors: ["a. writer"], isbn: "two" });
  assert.equal(matches.length, 1);
  assert.equal(normalizeWishlistText("The: Book!"), "the book");
});

test("exports pending and acquired wishes without leaking implementation fields", () => {
  const csv = wishlistCsv([{ ...base, isbn: "123", book_id: "book" }]);
  assert.match(csv, /Title,Authors,ISBN,Series ID,Volume,Price,Purchase link,Acquired/);
  assert.match(csv, /"Yes"/);
});
