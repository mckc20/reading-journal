import assert from "node:assert/strict";
import test from "node:test";
import { mergeStringValues, pruneSelectedIds, runBulkOperation, toggleAllVisibleIds } from "../src/lib/bulkManagement";

test("prunes selection to visible results and toggles all visible results", () => {
  assert.deepEqual([...pruneSelectedIds(new Set(["a", "b"]), ["b", "c"])], ["b"]);
  assert.deepEqual([...toggleAllVisibleIds(new Set(["a"]), ["a", "b"])].sort(), ["a", "b"]);
  assert.deepEqual([...toggleAllVisibleIds(new Set(["a", "b"]), ["a", "b"])], []);
});

test("merges and removes values without disturbing unrelated values", () => {
  assert.deepEqual(mergeStringValues(["Fantasy", "Sci-fi"], ["fantasy", "Romance"], "add"), ["Fantasy", "Sci-fi", "Romance"]);
  assert.deepEqual(mergeStringValues(["Fantasy", "Sci-fi", "Romance"], ["SCI-FI"], "remove"), ["Fantasy", "Romance"]);
});

test("bulk operations continue after a failure and report the failing item", async () => {
  const result = await runBulkOperation(["one", "two", "three"], (id) => ({ id, label: id }), async (id) => {
    if (id === "two") throw new Error("No access");
  });
  assert.equal(result.completed, 2);
  assert.deepEqual(result.failures, [{ id: "two", label: "two", message: "No access" }]);
});
