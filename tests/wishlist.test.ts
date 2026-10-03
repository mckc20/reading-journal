import assert from "node:assert/strict";
import test from "node:test";
import { findWishlistDuplicates, normalizedIsbn, normalizeWishlistText, wishlistCsv, wishlistDuplicateInput } from "../src/lib/wishlistLogic";
import { splitBookScopes } from "../src/lib/bookScopes";
import type { Book } from "../src/types";

const base: Book = { id: "wish", user_id: "user", title: "The Book", authors: ["A. Writer"], status: "Wishlist", is_favorite: false, created_at: "" };

test("normalizes ISBNs and identifies exact ISBN duplicates", () => {
  assert.equal(normalizedIsbn("978-1-234-X"), "9781234X");
  assert.equal(findWishlistDuplicates([{ ...base, isbn: "9781234X" }], { title: "Other", authors: ["Other"], isbn: "978-1-234-X" }).length, 1);
});

test("suspects a title and author duplicate while allowing another edition to be resolved by the UI", () => {
  const matches = findWishlistDuplicates([{ ...base, isbn: "one" }], { title: " the   book ", authors: ["a. writer"], isbn: "two" });
  assert.equal(matches.length, 1);
  assert.equal(normalizeWishlistText("The: Book!"), "the book");
});

test("exports wishlist purchase fields without acquisition history", () => {
  const csv = wishlistCsv([{ ...base, isbn: "123", price: 12.5, purchase_url: "https://example.com/buy" }]);
  assert.match(csv, /Title,Authors,ISBN,Series ID,Volume,Price,Purchase link\n/);
  assert.match(csv, /"12.5","https:\/\/example.com\/buy"/);
  assert.doesNotMatch(csv, /Acquired|book_id/);
});

test("duplicates wishlist metadata as an independent pending item", () => {
  const duplicate = wishlistDuplicateInput({
    ...base,
    cover_url: "https://example.com/cover.jpg",
    price: 12.5,
    purchase_url: "https://example.com/buy",
  });
  assert.equal(duplicate.title, "Copy of The Book");
  assert.equal(duplicate.status, "Wishlist");
  assert.equal(duplicate.cover_url, "https://example.com/cover.jpg");
  assert.equal("book_id" in duplicate, false);
  assert.equal(duplicate.price, 12.5);
  assert.equal(duplicate.purchase_url, "https://example.com/buy");
});

test("shared state excludes wishes from every library status", () => {
  const library = ["To Read", "Up Next", "Reading", "Paused", "Finished", "DNF"].map((status, i) => ({ ...base, id: String(i), status: status as Book["status"] }));
  const scopes = splitBookScopes([base, ...library]);
  assert.deepEqual(scopes.books, library);
  assert.deepEqual(scopes.wishlistBooks, [base]);
});

test("acquisition and moving only change scope, preserving the same record and reading data", () => {
  const wish = { ...base, price: 12.5, current_page: 100, rating: 4, date_finished: "2026-01-01" };
  const acquired: Book = { ...wish, status: "To Read" };
  assert.deepEqual(splitBookScopes([acquired]).books, [acquired]);
  assert.equal(acquired.id, wish.id);
  assert.equal(acquired.price, wish.price);
  assert.equal(acquired.current_page, wish.current_page);
  assert.deepEqual(splitBookScopes([{ ...acquired, status: "Wishlist" }]).wishlistBooks, [wish]);
});

test("wishlist duplication does not submit joined relations or reading progress", () => {
  const fetched = { ...base, current_page: 100, book_authors: [{ author_id: "author" }], book_genres: [] };
  const copy = wishlistDuplicateInput(fetched);
  assert.equal("book_authors" in copy, false);
  assert.equal("book_genres" in copy, false);
  assert.equal("current_page" in copy, false);
});
