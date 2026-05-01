import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCalendarSpan,
  formatTotalReadingTime,
  getEstimatedFinish,
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

function makeProgressLog(
  id: string,
  currentPage: number,
  loggedAt: string,
  minutes?: number
): ReadingLog {
  return {
    id,
    book_id: "book-1",
    user_id: "user-1",
    current_page: currentPage,
    reading_time_minutes: minutes,
    logged_at: loggedAt,
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

test("estimates finish date and remaining reading time for reading books", () => {
  const estimate = getEstimatedFinish({
    status: "Reading",
    currentPage: 80,
    totalPages: 200,
    now: new Date("2026-04-10T12:00:00"),
    logs: [
      makeProgressLog("a", 20, "2026-04-01T12:00:00", 30),
      makeProgressLog("b", 50, "2026-04-02T12:00:00", 50),
      makeProgressLog("c", 80, "2026-04-03T12:00:00", 40),
    ],
  });

  assert.equal(estimate.shouldShow, true);
  assert.equal(estimate.isAvailable, true);
  assert.equal(estimate.finishDate?.getFullYear(), 2026);
  assert.equal(estimate.finishDate?.getMonth(), 3);
  assert.equal(estimate.finishDate?.getDate(), 14);
  assert.equal(estimate.remainingMinutes, 180);
  assert.equal(estimate.confidence, "low");
  assert.equal(estimate.readingSessionCount, 3);
});

test("does not show estimated finish for books that are not currently reading", () => {
  const estimate = getEstimatedFinish({
    status: "Finished",
    currentPage: 200,
    totalPages: 200,
    logs: [
      makeProgressLog("a", 20, "2026-04-01T12:00:00", 30),
      makeProgressLog("b", 50, "2026-04-02T12:00:00", 50),
      makeProgressLog("c", 80, "2026-04-03T12:00:00", 40),
    ],
  });

  assert.equal(estimate.shouldShow, false);
  assert.equal(estimate.isAvailable, false);
  assert.equal(estimate.confidence, null);
  assert.equal(estimate.readingSessionCount, 0);
});

test("requires enough progress data before estimating finish", () => {
  const estimate = getEstimatedFinish({
    status: "Reading",
    currentPage: 50,
    totalPages: 200,
    logs: [
      makeProgressLog("a", 20, "2026-04-01T12:00:00", 30),
      makeProgressLog("b", 50, "2026-04-02T12:00:00", 50),
    ],
  });

  assert.equal(estimate.shouldShow, true);
  assert.equal(estimate.isAvailable, false);
  assert.equal(estimate.finishDate, null);
  assert.equal(estimate.remainingMinutes, null);
  assert.equal(estimate.confidence, null);
  assert.equal(estimate.readingSessionCount, 2);
});

test("assigns medium confidence for 6 to 9 reading logs", () => {
  const estimate = getEstimatedFinish({
    status: "Reading",
    currentPage: 100,
    totalPages: 200,
    now: new Date("2026-04-10T12:00:00"),
    logs: [
      makeProgressLog("a", 10, "2026-04-01T12:00:00", 10),
      makeProgressLog("b", 25, "2026-04-02T12:00:00", 15),
      makeProgressLog("c", 40, "2026-04-03T12:00:00", 15),
      makeProgressLog("d", 60, "2026-04-04T12:00:00", 20),
      makeProgressLog("e", 80, "2026-04-05T12:00:00", 20),
      makeProgressLog("f", 100, "2026-04-06T12:00:00", 20),
    ],
  });

  assert.equal(estimate.isAvailable, true);
  assert.equal(estimate.confidence, "medium");
  assert.equal(estimate.readingSessionCount, 6);
});

test("assigns high confidence for 10 or more reading logs", () => {
  const estimate = getEstimatedFinish({
    status: "Reading",
    currentPage: 110,
    totalPages: 200,
    now: new Date("2026-04-12T12:00:00"),
    logs: [
      makeProgressLog("a", 10, "2026-04-01T12:00:00", 10),
      makeProgressLog("b", 20, "2026-04-02T12:00:00", 10),
      makeProgressLog("c", 30, "2026-04-03T12:00:00", 10),
      makeProgressLog("d", 40, "2026-04-04T12:00:00", 10),
      makeProgressLog("e", 50, "2026-04-05T12:00:00", 10),
      makeProgressLog("f", 60, "2026-04-06T12:00:00", 10),
      makeProgressLog("g", 70, "2026-04-07T12:00:00", 10),
      makeProgressLog("h", 80, "2026-04-08T12:00:00", 10),
      makeProgressLog("i", 95, "2026-04-09T12:00:00", 15),
      makeProgressLog("j", 110, "2026-04-10T12:00:00", 15),
    ],
  });

  assert.equal(estimate.isAvailable, true);
  assert.equal(estimate.confidence, "high");
  assert.equal(estimate.readingSessionCount, 10);
});
