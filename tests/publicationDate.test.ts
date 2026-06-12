import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPublicationDateForDisplay,
  formatPublicationDateInput,
  parsePublicationDateInput,
} from "../src/lib/publicationDate";

test("parses manual year-only publication dates into real stored dates", () => {
  assert.deepEqual(parsePublicationDateInput("2020", "year"), {
    date: "2020-01-01",
    precision: "year",
  });
});

test("parses manual year-month publication dates into real stored dates", () => {
  assert.deepEqual(parsePublicationDateInput("2020-05", "month"), {
    date: "2020-05-01",
    precision: "month",
  });
});

test("parses manual full publication dates", () => {
  assert.deepEqual(parsePublicationDateInput("2020-05-14", "day"), {
    date: "2020-05-14",
    precision: "day",
  });
});

test("rejects manual publication dates that do not match the selected precision", () => {
  assert.equal(parsePublicationDateInput("2020-05", "year"), undefined);
  assert.equal(parsePublicationDateInput("2020", "month"), undefined);
  assert.equal(parsePublicationDateInput("2020-05-14", "month"), undefined);
});

test("rejects impossible manual publication dates", () => {
  assert.equal(parsePublicationDateInput("2020-13", "month"), undefined);
  assert.equal(parsePublicationDateInput("2020-00", "month"), undefined);
  assert.equal(parsePublicationDateInput("2020-02-31", "day"), undefined);
});

test("formats stored publication dates for the edit input precision", () => {
  assert.equal(formatPublicationDateInput("2020-01-01", "year"), "2020");
  assert.equal(formatPublicationDateInput("2020-05-01", "month"), "2020-05");
  assert.equal(formatPublicationDateInput("2020-05-14", "day"), "2020-05-14");
});

test("formats publication date display month names in English", () => {
  assert.equal(formatPublicationDateForDisplay("2020-05-01", "month"), "May 2020");
  assert.equal(formatPublicationDateForDisplay("2020-05-14", "day"), "May 14, 2020");
});
