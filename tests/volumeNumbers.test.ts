import assert from "node:assert/strict";
import test from "node:test";
import { formatVolumeNumber, parseVolumeNumberInput } from "../src/lib/volumeNumbers";

test("parses positive volume numbers with up to two decimal places", () => {
  assert.equal(parseVolumeNumberInput("1"), 1);
  assert.equal(parseVolumeNumberInput("0.25"), 0.25);
  assert.equal(parseVolumeNumberInput("12.5"), 12.5);
  assert.equal(parseVolumeNumberInput("12.50"), 12.5);
});

test("rejects volume numbers with more than two decimal places", () => {
  assert.equal(parseVolumeNumberInput("0.333"), null);
  assert.equal(parseVolumeNumberInput("1.001"), null);
});

test("rejects empty, zero, negative, and incomplete volume inputs", () => {
  assert.equal(parseVolumeNumberInput(""), null);
  assert.equal(parseVolumeNumberInput("0"), null);
  assert.equal(parseVolumeNumberInput("-1"), null);
  assert.equal(parseVolumeNumberInput("1."), null);
});

test("formats volume numbers with at most two decimal places", () => {
  assert.equal(formatVolumeNumber(1), "1");
  assert.equal(formatVolumeNumber(0.25), "0.25");
  assert.equal(formatVolumeNumber(1.2), "1.2");
});
