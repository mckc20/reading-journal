import assert from "node:assert/strict";
import test from "node:test";
import { normalizeScannedIsbn } from "../src/lib/isbnScan";

test("accepts valid Bookland EAN-13 ISBN barcodes", () => {
  assert.equal(normalizeScannedIsbn("9780306406157"), "9780306406157");
  assert.equal(normalizeScannedIsbn("9791090636071"), "9791090636071");
});

test("normalizes harmless whitespace and separators", () => {
  assert.equal(normalizeScannedIsbn(" 978-0-306-40615-7 "), "9780306406157");
});

test("rejects non-ISBN barcode formats and prefixes", () => {
  assert.equal(normalizeScannedIsbn("96385074"), null);
  assert.equal(normalizeScannedIsbn("4006381333931"), null);
});

test("rejects Bookland EAN-13 values with invalid checksums", () => {
  assert.equal(normalizeScannedIsbn("9780306406158"), null);
});
