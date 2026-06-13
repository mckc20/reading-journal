import assert from "node:assert/strict";
import test from "node:test";
import { getAllowedGenres } from "../src/lib/bookGenres";

test("keeps approved genres and normalizes their display casing", () => {
  assert.deepEqual(getAllowedGenres(["fantasy", "Science fiction", "Mystery & crime"]), [
    "Fantasy",
    "Science Fiction",
    "Mystery & Crime",
  ]);
});

test("ignores unknown genres from external metadata", () => {
  assert.deepEqual(getAllowedGenres(["Juvenile Fiction", "Mystery", "Romance"]), ["Romance"]);
});

test("removes duplicate approved genres", () => {
  assert.deepEqual(getAllowedGenres(["History", "history", "History"]), ["History"]);
});
