import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPublicationDateForDisplay,
  formatPublicationDateInput,
  parsePublicationDateInput,
} from "../src/lib/publicationDate";

test("parses manual year-only publication dates into real stored dates", () => {
  assert.deepEqual(parsePublicationDateInput("2020"), {
    date: "2020-01-01",
  });
});

test("rejects manual publication dates with months or days", () => {
  assert.equal(parsePublicationDateInput("2020-05"), undefined);
  assert.equal(parsePublicationDateInput("2020-05-14"), undefined);
  assert.equal(parsePublicationDateInput("May 2020"), undefined);
});

test("formats stored publication dates for the edit input", () => {
  assert.equal(formatPublicationDateInput("2020-01-01"), "2020");
  assert.equal(formatPublicationDateInput("2020-05-14"), "2020");
});

test("formats publication date display as a year", () => {
  assert.equal(formatPublicationDateForDisplay("2020-05-01"), "2020");
  assert.equal(formatPublicationDateForDisplay("2020-05-14"), "2020");
});
