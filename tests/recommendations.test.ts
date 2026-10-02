import assert from "node:assert/strict";
import test from "node:test";
import {
  isRecommendationSetStale,
  expiresAt,
  rankCandidates,
  recommendationCandidateKey,
  recommendationFingerprint,
  RECOMMENDATION_STRATEGY_VERSION,
  selectRecommendationMix,
  tasteForBooks,
  type LibraryBook,
  type RecommendationCandidate,
} from "../api/_lib/recommendations";

const library: LibraryBook[] = [
  { title: "Loved", authors: ["A. Writer"], genres: ["Fantasy"], isbn: "111", status: "Finished", rating: 5, is_favorite: true },
  { title: "Fine", authors: ["A. Writer"], genres: ["Fantasy"], isbn: "222", status: "Finished", rating: 3, is_favorite: false },
  { title: "Disliked", authors: ["B. Writer"], genres: ["Mystery"], isbn: "333", status: "Finished", rating: 2, is_favorite: true },
  { title: "Still reading", authors: ["C. Writer"], genres: ["Romance"], isbn: "444", status: "Reading", rating: 5, is_favorite: true },
  { title: "Unknown author", authors: ["Unknown"], genres: [], isbn: null, status: "Finished", rating: 4, is_favorite: false },
];

function candidate(id: string, title: string, authors: string[], genres: string[], isbn?: string): RecommendationCandidate {
  return { id, source: "google_books", sourceUrl: `https://books.google.com/${id}`, title, authors, genres, isbn };
}

test("taste uses only finished books rated at least three and skips placeholder authors", () => {
  const taste = tasteForBooks(library);
  assert.deepEqual(taste.authors.map(({ name, strength }) => [name, strength]), [["A. Writer", 5]]);
  assert.deepEqual(taste.genres.map(({ name, strength }) => [name, strength]), [["Fantasy", 5]]);
});

test("Wishlist items add a weak signal capped at one unrated finished book per author and genre", () => {
  const wishes: LibraryBook[] = Array.from({ length: 8 }, (_, index) => ({
    title: `Wish ${index}`,
    authors: ["Wish Writer"],
    genres: ["Science Fiction"],
    isbn: `wish-${index}`,
    status: "Wishlist",
    rating: null,
    is_favorite: false,
  }));
  const singleWishTaste = tasteForBooks(wishes.slice(0, 1));
  assert.equal(singleWishTaste.authors[0].strength, 0.25);
  const taste = tasteForBooks([...library, ...wishes]);
  assert.deepEqual(taste.authors.find(({ name }) => name === "Wish Writer"), {
    name: "Wish Writer", strength: 1, finishedStrength: 0, wishlistStrength: 1,
  });
  assert.deepEqual(taste.genres.find(({ name }) => name === "Science Fiction"), {
    name: "Science Fiction", strength: 1, finishedStrength: 0, wishlistStrength: 1,
  });
  assert.equal(taste.authors.find(({ name }) => name === "A. Writer")?.finishedStrength, 5);
});

test("Wishlist-only matches are described as saved interest and exact Wishlist items are excluded", () => {
  const wish: LibraryBook = {
    title: "Wishlisted Title", authors: ["Wish Writer"], genres: ["Science Fiction"], isbn: "wish-isbn",
    status: "Wishlist", rating: null, is_favorite: false,
  };
  const taste = tasteForBooks([wish]);
  const ranked = rankCandidates([
    candidate("related", "Another Story", ["Wish Writer"], ["Science Fiction"]),
    candidate("wishlisted", "Wishlisted Title", ["Wish Writer"], ["Science Fiction"], "wish-isbn"),
  ], [wish], taste);
  assert.deepEqual(ranked.map((item) => item.id), ["related"]);
  assert.deepEqual(ranked[0].reasons, [
    "Because you saved books by Wish Writer to your Wishlist",
    "Because you saved books in Science Fiction to your Wishlist",
  ]);
});

test("ranking excludes owned books and catalogue noise, then favors author matches", () => {
  const taste = tasteForBooks(library);
  const ranked = rankCandidates([
    candidate("author", "A New Story", ["A. Writer"], []),
    candidate("genre", "Fantasy Tale", ["Different Writer"], ["Fiction / Fantasy"]),
    candidate("owned", "Loved", ["A. Writer"], ["Fantasy"]),
    candidate("noise", "Fantasy Exam Study Guide", ["A. Writer"], ["Fantasy"]),
  ], library, taste);
  assert.deepEqual(ranked.map((item) => item.id), ["author", "genre"]);
  assert.ok(ranked[0].score > ranked[1].score);
  assert.match(ranked[0].reasons[0], /A\. Writer/);
});

test("dislikes strongly demote an exact book and gently lower matching authors and genres", () => {
  const taste = tasteForBooks(library);
  const candidates = [
    candidate("exact", "A New Story", ["A. Writer"], ["Fantasy"]),
    candidate("author", "Another Story", ["A. Writer"], ["Mystery"]),
    candidate("genre", "Fantasy Tale", ["Different Writer"], ["Fantasy"]),
    candidate("unrelated", "Other Story", ["Different Writer"], ["Romance"]),
  ];
  const baseline = rankCandidates(candidates, library, taste);
  const withFeedback = rankCandidates(candidates, library, taste, [{
    candidate_key: "title:a new story|a. writer",
    title: "A New Story",
    authors: ["A. Writer"],
    genres: ["Fantasy"],
  }]);
  const score = (items: typeof baseline, id: string) => items.find((item) => item.id === id)?.score ?? -Infinity;
  assert.ok(score(withFeedback, "exact") < score(withFeedback, "author"));
  assert.ok(score(withFeedback, "author") < score(baseline, "author"));
  assert.ok(score(withFeedback, "genre") < score(baseline, "genre"));
  assert.equal(score(withFeedback, "unrelated"), score(baseline, "unrelated"));
});

test("recommendation expiry follows the selected day, week, and month interval", () => {
  const start = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(expiresAt(start, { number: 2, unit: "day" }), "2026-09-03T00:00:00.000Z");
  assert.equal(expiresAt(start, { number: 1, unit: "week" }), "2026-09-08T00:00:00.000Z");
  assert.equal(expiresAt(start, { number: 1, unit: "month" }), "2026-10-01T00:00:00.000Z");
});

test("recommendation mix alternates unseen titles with previously shown books", () => {
  const taste = tasteForBooks(library);
  const oldItems = rankCandidates(
    Array.from({ length: 8 }, (_, index) => candidate(`old-${index}`, `Old Story ${index}`, ["A. Writer"], ["Fantasy"])),
    library,
    taste,
  );
  const freshItems = rankCandidates(
    Array.from({ length: 8 }, (_, index) => candidate(`new-${index}`, `New Story ${index}`, ["A. Writer"], ["Fantasy"])),
    library,
    taste,
  );
  const history = oldItems.map((item) => ({ candidate_key: recommendationCandidateKey(item), item }));
  const mixed = selectRecommendationMix([...freshItems, ...oldItems], oldItems, history);
  const unseenCount = mixed.filter((item) => !history.some((entry) => entry.candidate_key === recommendationCandidateKey(item))).length;
  assert.equal(mixed.length, 12);
  assert.equal(unseenCount, 6);
  assert.equal(mixed.slice(0, 4).filter((item) => !history.some((entry) => entry.candidate_key === recommendationCandidateKey(item))).length, 2);
});

test("recommendation mix reuses prior books when fewer than six unseen matches exist", () => {
  const taste = tasteForBooks(library);
  const oldItems = rankCandidates(
    Array.from({ length: 10 }, (_, index) => candidate(`old-${index}`, `Old Story ${index}`, ["A. Writer"], ["Fantasy"])),
    library,
    taste,
  );
  const freshItems = rankCandidates(
    [candidate("new-1", "New Story 1", ["A. Writer"], ["Fantasy"]), candidate("new-2", "New Story 2", ["A. Writer"], ["Fantasy"])],
    library,
    taste,
  );
  const history = oldItems.map((item) => ({ candidate_key: recommendationCandidateKey(item), item }));
  const mixed = selectRecommendationMix([...freshItems, ...oldItems], oldItems, history);
  assert.equal(mixed.length, 12);
  assert.equal(mixed.filter((item) => !history.some((entry) => entry.candidate_key === recommendationCandidateKey(item))).length, 2);
});

test("recommendation mix reuses history when no unseen matches are available", () => {
  const taste = tasteForBooks(library);
  const oldItems = rankCandidates(
    Array.from({ length: 12 }, (_, index) => candidate(`old-${index}`, `Old Story ${index}`, ["A. Writer"], ["Fantasy"])),
    library,
    taste,
  );
  const history = oldItems.map((item, index) => ({
    candidate_key: recommendationCandidateKey(item),
    item,
    last_seen_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
  const mixed = selectRecommendationMix([], [], history);
  assert.equal(mixed.length, 12);
  assert.equal(new Set(mixed.map(recommendationCandidateKey)).size, 12);
});

test("fingerprint tracks ownership, status, rating, favorite, author, and genre inputs", () => {
  const original = recommendationFingerprint(library);
  assert.equal(recommendationFingerprint([...library].reverse()), original);
  const wish: LibraryBook = {
    title: "Wishlisted Title", authors: ["Wish Writer"], genres: ["Science Fiction"], isbn: "wish-isbn",
    status: "Wishlist", rating: null, is_favorite: false,
  };
  assert.notEqual(recommendationFingerprint([...library, wish]), original);
  assert.notEqual(recommendationFingerprint([{ ...library[0], status: "To Read" }, ...library.slice(1)]), original);
  assert.notEqual(recommendationFingerprint([{ ...library[0], rating: 4 }, ...library.slice(1)]), original);
  assert.notEqual(recommendationFingerprint([{ ...library[0], authors: ["Other"] }, ...library.slice(1)]), original);
  assert.notEqual(recommendationFingerprint(library, [{ candidate_key: "isbn:123", title: "No", authors: ["Someone"], genres: ["Horror"] }]), original);
});

test("set expires on time or when strategy or taste changes", () => {
  const set = { generated_at: "2026-09-01T00:00:00.000Z", expires_at: "2026-09-03T00:00:00.000Z", strategy_version: RECOMMENDATION_STRATEGY_VERSION, taste_fingerprint: "abc" };
  assert.equal(isRecommendationSetStale(set, "abc", Date.parse("2026-09-02T00:00:00.000Z")), false);
  assert.equal(isRecommendationSetStale(set, "abc", Date.parse("2026-09-04T00:00:00.000Z")), true);
  assert.equal(isRecommendationSetStale(set, "def", Date.parse("2026-09-02T00:00:00.000Z")), true);
  assert.equal(isRecommendationSetStale({ ...set, strategy_version: "deterministic-v2" }, "abc", Date.parse("2026-09-02T00:00:00.000Z")), true);
});
