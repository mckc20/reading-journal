import assert from "node:assert/strict";
import test from "node:test";
import { selectionLabel } from "../src/lib/selectionLabels";

test("confirmation labels use singular wording for one selected item", () => {
  for (const kind of ["book", "author", "series", "wish"] as const) {
    assert.equal(selectionLabel(kind, 1), kind);
  }
});

test("confirmation labels show counts and correct plurals for multiple items", () => {
  assert.equal(selectionLabel("book", 3), "3 books");
  assert.equal(selectionLabel("author", 2), "2 authors");
  assert.equal(selectionLabel("series", 4), "4 series");
  assert.equal(selectionLabel("wish", 2), "2 wishes");
});
