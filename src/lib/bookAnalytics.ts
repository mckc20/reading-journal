import type { ReadingLog } from "@/types";

export interface CalendarSpan {
  months: number;
  weeks: number;
  days: number;
}

export interface ReadingDurationResult {
  isAvailable: boolean;
  isInProgress: boolean;
  span: CalendarSpan | null;
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetYear = date.getFullYear();
  const targetMonthIndex = date.getMonth() + months;

  const firstOfTargetMonth = new Date(targetYear, targetMonthIndex, 1);
  const lastDayOfTargetMonth = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0
  ).getDate();

  const day = Math.min(date.getDate(), lastDayOfTargetMonth);
  return new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), day);
}

export function parseLocalDateOnly(value?: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);
  if (!isValidDate(parsed)) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() !== monthIndex || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
}

export function sumReadingMinutes(logs: ReadingLog[]): number {
  return logs.reduce((sum, log) => {
    const minutes = log.reading_time_minutes;
    if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return sum;
    return sum + Math.round(minutes);
  }, 0);
}

export function formatTotalReadingTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return "No sessions logged";

  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

export function calculateCalendarSpan(startDate: Date, endDate: Date): CalendarSpan {
  const start = startOfLocalDay(startDate);
  const end = startOfLocalDay(endDate);

  if (!isValidDate(start) || !isValidDate(end) || end < start) {
    return { months: 0, weeks: 0, days: 0 };
  }

  let months = 0;
  let cursor = start;

  while (true) {
    const nextMonth = addMonthsClamped(cursor, 1);
    if (nextMonth <= end) {
      months += 1;
      cursor = nextMonth;
      continue;
    }
    break;
  }

  const remainingMs = end.getTime() - cursor.getTime();
  const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const weeks = Math.floor(remainingDays / 7);
  const days = remainingDays % 7;

  return { months, weeks, days };
}

export function formatCalendarSpan(span: CalendarSpan): string {
  const parts: string[] = [];

  if (span.months > 0) parts.push(`${span.months} month${span.months === 1 ? "" : "s"}`);
  if (span.weeks > 0) parts.push(`${span.weeks} week${span.weeks === 1 ? "" : "s"}`);
  if (span.days > 0) parts.push(`${span.days} day${span.days === 1 ? "" : "s"}`);

  return parts.length > 0 ? parts.join(" ") : "0 days";
}

export function getReadingDuration(params: {
  dateStarted?: string;
  dateFinished?: string;
  now?: Date;
}): ReadingDurationResult {
  const started = parseLocalDateOnly(params.dateStarted);
  if (!started) {
    return {
      isAvailable: false,
      isInProgress: false,
      span: null,
    };
  }

  const finished = parseLocalDateOnly(params.dateFinished);
  const isInProgress = !finished;
  const fallbackNow = params.now ?? new Date();
  const endDate = finished ?? startOfLocalDay(fallbackNow);

  if (!isValidDate(endDate) || endDate < started) {
    return {
      isAvailable: false,
      isInProgress,
      span: null,
    };
  }

  return {
    isAvailable: true,
    isInProgress,
    span: calculateCalendarSpan(started, endDate),
  };
}
