import type { ReadingLog } from "../types/index.js";

export function toDateTimeLocalValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function getLocalReadingDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return { day: toDateTimeLocalValue(date).slice(0, 10), start };
}

export function getLoggedSessionMinutes(logs: ReadingLog[], startOfDay: Date, end: Date): number {
  const endTime = end.getTime();
  const windowStart = logs.reduce((start, log) => {
    const loggedAt = Date.parse(log.logged_at);
    return log.kind === "progress_update" && loggedAt <= endTime ? Math.max(start, loggedAt) : start;
  }, startOfDay.getTime());

  return logs.reduce((sum, log) => {
    if (log.kind !== "session" || !log.session_started_at) return sum;
    const overlapStart = Math.max(windowStart, Date.parse(log.session_started_at));
    const overlapEnd = Math.min(endTime, Date.parse(log.logged_at));
    return sum + Math.max(0, overlapEnd - overlapStart) / 60_000;
  }, 0);
}

export function getSessionTimes(day: Date, startMinute: number, endMinute: number, now = new Date()) {
  if (getLocalReadingDay(day).day !== getLocalReadingDay(now).day) {
    throw new Error("A new day has started. Reopen the form to log a session for today.");
  }

  function toTime(minute: number) {
    const time = new Date(day);
    const hour = Math.floor(minute / 60);
    const minuteInHour = minute % 60;
    time.setHours(hour, minuteInHour, 0, 0);
    if (time.getHours() !== hour || time.getMinutes() !== minuteInHour) {
      throw new Error("That time is skipped by the local clock change. Choose another time.");
    }
    return time;
  }

  const start = toTime(startMinute);
  const end = toTime(endMinute);
  if (start >= end) throw new Error("Choose a start time before the end time.");
  if (end > now) throw new Error("Choose an end time at or before now.");
  return { start, end };
}

export function isReadingSession(log: Pick<ReadingLog, "kind">): boolean {
  return log.kind !== "progress_update";
}
