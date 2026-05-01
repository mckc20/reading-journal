import type { BookStatus, ReadingLog } from "@/types";

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

export interface EstimatedFinishResult {
  shouldShow: boolean;
  isAvailable: boolean;
  finishDate: Date | null;
  remainingMinutes: number | null;
  confidence: "low" | "medium" | "high" | null;
  readingSessionCount: number;
}

export const MIN_READING_LOGS_FOR_ESTIMATED_FINISH = 3;

function getEstimateConfidence(readingSessionCount: number): EstimatedFinishResult["confidence"] {
  if (readingSessionCount >= 10) return "high";
  if (readingSessionCount >= 6) return "medium";
  if (readingSessionCount >= MIN_READING_LOGS_FOR_ESTIMATED_FINISH) return "low";
  return null;
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function wholeDaysBetween(startDate: Date, endDate: Date): number {
  const start = startOfLocalDay(startDate);
  const end = startOfLocalDay(endDate);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
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

export function getEstimatedFinish(params: {
  status: BookStatus;
  currentPage?: number;
  totalPages?: number;
  logs: ReadingLog[];
  now?: Date;
}): EstimatedFinishResult {
  if (params.status !== "Reading") {
    return {
      shouldShow: false,
      isAvailable: false,
      finishDate: null,
      remainingMinutes: null,
      confidence: null,
      readingSessionCount: 0,
    };
  }

  const currentPage = params.currentPage ?? 0;
  const totalPages = params.totalPages ?? 0;
  const remainingPages = totalPages - currentPage;
  const sortedLogs = [...params.logs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  if (
    sortedLogs.length < MIN_READING_LOGS_FOR_ESTIMATED_FINISH ||
    totalPages <= 0 ||
    currentPage < 0 ||
    remainingPages <= 0
  ) {
    return {
      shouldShow: true,
      isAvailable: false,
      finishDate: null,
      remainingMinutes: null,
      confidence: null,
      readingSessionCount: sortedLogs.length,
    };
  }

  const firstLog = sortedLogs[0];
  const lastLog = sortedLogs[sortedLogs.length - 1];
  const firstLogDate = new Date(firstLog.logged_at);
  const lastLogDate = new Date(lastLog.logged_at);
  const loggedDays = wholeDaysBetween(firstLogDate, lastLogDate);
  const loggedProgress = lastLog.current_page - firstLog.current_page;

  if (!isValidDate(firstLogDate) || !isValidDate(lastLogDate) || loggedDays <= 0 || loggedProgress <= 0) {
    return {
      shouldShow: true,
      isAvailable: false,
      finishDate: null,
      remainingMinutes: null,
      confidence: null,
      readingSessionCount: sortedLogs.length,
    };
  }

  const pagesPerDay = loggedProgress / loggedDays;
  const daysRemaining = Math.ceil(remainingPages / pagesPerDay);
  const now = startOfLocalDay(params.now ?? new Date());
  const finishDate = new Date(now);
  finishDate.setDate(finishDate.getDate() + daysRemaining);

  let previousPage = 0;
  let pagesWithTime = 0;
  let minutesWithProgress = 0;

  for (const log of sortedLogs) {
    const pagesRead = Math.max(0, log.current_page - previousPage);
    const minutes = log.reading_time_minutes ?? 0;
    if (pagesRead > 0 && minutes > 0) {
      pagesWithTime += pagesRead;
      minutesWithProgress += minutes;
    }
    previousPage = log.current_page;
  }

  const remainingMinutes =
    pagesWithTime > 0 && minutesWithProgress > 0
      ? Math.ceil(remainingPages / (pagesWithTime / minutesWithProgress))
      : null;

  return {
    shouldShow: true,
    isAvailable: true,
    finishDate,
    remainingMinutes,
    confidence: getEstimateConfidence(sortedLogs.length),
    readingSessionCount: sortedLogs.length,
  };
}
