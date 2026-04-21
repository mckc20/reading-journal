import test from "node:test";
import assert from "node:assert/strict";
import { calculateReadingHabits } from "../src/lib/readingHabits";
import type { ReadingLog } from "../src/types";

function makeLog(
  id: string,
  bookId: string,
  loggedAt: string,
  currentPage: number,
  readingMinutes?: number
): ReadingLog {
  return {
    id,
    book_id: bookId,
    user_id: "user-1",
    current_page: currentPage,
    reading_time_minutes: readingMinutes,
    logged_at: loggedAt,
  };
}

test("returns empty metrics for no logs", () => {
  const metrics = calculateReadingHabits([], "2026-01-01T00:00:00", "2026-01-31T23:59:59");

  assert.equal(metrics.totalLogs, 0);
  assert.equal(metrics.duration.averageMinutes, null);
  assert.equal(metrics.speed.averagePagesPerHour, null);
  assert.equal(metrics.usualTime.dominantHourLabel, null);
  assert.equal(metrics.weekdays.highest, null);
  assert.equal(metrics.weekdays.lowest, null);
});

test("computes weighted speed and excludes each book's first in-range log", () => {
  const logs: ReadingLog[] = [
    makeLog("a1", "book-a", "2026-01-01T08:00:00", 50, 30),
    makeLog("a2", "book-a", "2026-01-02T08:00:00", 80, 30),
    makeLog("a3", "book-a", "2026-01-03T08:00:00", 100, 60),
    makeLog("b1", "book-b", "2026-01-01T21:00:00", 120, 20),
    makeLog("b2", "book-b", "2026-01-02T21:00:00", 180, 40),
  ];

  const metrics = calculateReadingHabits(logs, "2026-01-01T00:00:00", "2026-01-31T23:59:59");

  assert.equal(metrics.duration.averageMinutes, 36);
  assert.equal(metrics.duration.sessionsUsed, 5);

  assert.equal(metrics.speed.sessionsUsed, 3);
  assert.equal(metrics.speed.totalPages, 110);
  assert.ok(metrics.speed.totalHours);
  assert.ok(metrics.speed.averagePagesPerHour);
  assert.equal(metrics.speed.totalHours.toFixed(2), "2.17");
  assert.equal(metrics.speed.averagePagesPerHour.toFixed(1), "50.8");
});

test("ignores zero minutes and non-positive page deltas for speed", () => {
  const logs: ReadingLog[] = [
    makeLog("a1", "book-a", "2026-01-01T10:00:00", 50, 25),
    makeLog("a2", "book-a", "2026-01-02T10:00:00", 60, 0),
    makeLog("a3", "book-a", "2026-01-03T10:00:00", 58, 20),
    makeLog("a4", "book-a", "2026-01-04T10:00:00", 70, 30),
  ];

  const metrics = calculateReadingHabits(logs, "2026-01-01T00:00:00", "2026-01-31T23:59:59");

  assert.equal(metrics.speed.sessionsUsed, 1);
  assert.equal(metrics.speed.totalPages, 12);
  assert.equal(metrics.speed.totalHours, 0.5);
  assert.equal(metrics.speed.averagePagesPerHour, 24);
});

test("computes usual reading time and dominant hour in local time", () => {
  const logs: ReadingLog[] = [
    makeLog("l1", "book-a", "2026-01-01T06:15:00", 10, 15),
    makeLog("l2", "book-a", "2026-01-02T06:45:00", 20, 15),
    makeLog("l3", "book-a", "2026-01-03T13:00:00", 30, 15),
    makeLog("l4", "book-a", "2026-01-04T20:30:00", 40, 15),
    makeLog("l5", "book-a", "2026-01-05T23:30:00", 50, 15),
  ];

  const metrics = calculateReadingHabits(logs, "2026-01-01T00:00:00", "2026-01-31T23:59:59");
  const morning = metrics.usualTime.dayParts.find((part) => part.label === "Morning");

  assert.equal(metrics.usualTime.dominantHourLabel, "06:00-07:00");
  assert.ok(morning);
  assert.equal(morning?.sessions, 2);
  assert.equal(Math.round(morning?.percentage ?? 0), 40);
});

test("normalizes weekday metrics per week and uses sessions as tie-breaker", () => {
  const logs: ReadingLog[] = [
    makeLog("m1", "book-a", "2026-01-05T09:00:00", 10, 30),
    makeLog("m2", "book-a", "2026-01-05T20:00:00", 20, 30),
    makeLog("t1", "book-a", "2026-01-06T09:00:00", 30, 30),
    makeLog("w1", "book-a", "2026-01-07T09:00:00", 40, 10),
  ];

  const metrics = calculateReadingHabits(logs, "2026-01-01T00:00:00", "2026-01-31T23:59:59");

  assert.equal(metrics.weekdays.highest?.weekdayLabel, "Monday");
  assert.equal(metrics.weekdays.lowest?.weekdayLabel, "Thursday");
  assert.ok(metrics.weekdays.weekSpan > 4);
});
