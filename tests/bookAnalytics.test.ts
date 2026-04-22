import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCalendarSpan,
  formatTotalReadingTime,
  getReadingDuration,
  sumReadingMinutes,
} from "../src/lib/bookAnalytics";
import type { ReadingLog } from "../src/types";

function makeLog(id: string, minutes?: number): ReadingLog {
  return {
    id,
    book_id: "book-1",
    user_id: "user-1",
    current_page: 10,
    reading_time_minutes: minutes,
    logged_at: "2026-04-01T12:00:00",
  };
}

test("sums reading minutes and formats with days, hours, and minutes", () => {
  const logs: ReadingLog[] = [makeLog("a", 60), makeLog("b", 24 * 60), makeLog("c", 15)];
  const total = sumReadingMinutes(logs);

  assert.equal(total, 1515);
  assert.equal(formatTotalReadingTime(total), "1d 1h 15m");
});

test("handles missing or zero reading minutes as no sessions logged", () => {
  const logs: ReadingLog[] = [makeLog("a"), makeLog("b", 0), makeLog("c", -10)];
  const total = sumReadingMinutes(logs);

  assert.equal(total, 0);
  assert.equal(formatTotalReadingTime(total), "No sessions logged");
});

test("computes reading duration for a finished book", () => {
  const duration = getReadingDuration({
    dateStarted: "2026-01-15",
    dateFinished: "2026-03-05",
  });

  assert.equal(duration.isAvailable, true);
  assert.equal(duration.isInProgress, false);
  assert.deepEqual(duration.span, { months: 1, weeks: 2, days: 4 });
  assert.equal(formatCalendarSpan(duration.span!), "1 month 2 weeks 4 days");
});

test("computes in-progress reading duration to provided current date", () => {
  const duration = getReadingDuration({
    dateStarted: "2026-04-01",
    now: new Date("2026-04-20T09:30:00"),
  });

  assert.equal(duration.isAvailable, true);
  assert.equal(duration.isInProgress, true);
  assert.deepEqual(duration.span, { months: 0, weeks: 2, days: 5 });
  assert.equal(formatCalendarSpan(duration.span!), "2 weeks 5 days");
});

test("returns unavailable when start date is missing or invalid range", () => {
  const missingStart = getReadingDuration({ dateFinished: "2026-04-20" });
  const reversed = getReadingDuration({
    dateStarted: "2026-04-20",
    dateFinished: "2026-04-10",
  });

  assert.equal(missingStart.isAvailable, false);
  assert.equal(missingStart.span, null);

  assert.equal(reversed.isAvailable, false);
  assert.equal(reversed.span, null);
});
