import type { BookPausePeriod, BookStatus, ReadingLog } from "@/types";

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

export interface ProgressTimelinePoint {
  dayKey: string;
  currentPage: number;
  progressPercent: number;
  isStart: boolean;
  hasProgressIncrease: boolean;
}

export interface PauseTimelineSegment {
  startDayKey: string;
  endDayKey: string;
  durationDays: number;
  isOpenEnded: boolean;
}

export interface ProgressTimelineResult {
  isAvailable: boolean;
  points: ProgressTimelinePoint[];
  pauseSegments: PauseTimelineSegment[];
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

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
}

function wholeDaysBetween(startDate: Date, endDate: Date): number {
  const start = startOfLocalDay(startDate);
  const end = startOfLocalDay(endDate);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function getPauseSegments(
  pausePeriods: BookPausePeriod[] | undefined,
  now: Date,
): PauseTimelineSegment[] {
  return (pausePeriods ?? [])
    .flatMap((period) => {
      const pausedAt = parseTimestamp(period.paused_at);
      if (!pausedAt) return [];

      const resumedAt = parseTimestamp(period.resumed_at ?? undefined) ?? startOfLocalDay(now);
      const start = startOfLocalDay(pausedAt);
      const end = startOfLocalDay(resumedAt);
      if (end < start) return [];

      return [
        {
          startDayKey: toLocalDayKey(start),
          endDayKey: toLocalDayKey(end),
          durationDays: wholeDaysBetween(start, end),
          isOpenEnded: !period.resumed_at,
        },
      ];
    })
    .sort((a, b) => a.startDayKey.localeCompare(b.startDayKey));
}

function getPauseDaysBetween(
  startDate: Date,
  endDate: Date,
  pausePeriods: BookPausePeriod[] | undefined,
  now: Date,
): number {
  const start = startOfLocalDay(startDate);
  const end = startOfLocalDay(endDate);
  if (end < start) return 0;

  let pausedDays = 0;

  for (const segment of getPauseSegments(pausePeriods, now)) {
    const pauseStart = parseLocalDateOnly(segment.startDayKey);
    const pauseEnd = parseLocalDateOnly(segment.endDayKey);
    if (!pauseStart || !pauseEnd) continue;

    const overlapStart = pauseStart > start ? pauseStart : start;
    const overlapEnd = pauseEnd < end ? pauseEnd : end;
    if (overlapEnd < overlapStart) continue;

    pausedDays += wholeDaysBetween(overlapStart, overlapEnd);
  }

  return Math.max(0, pausedDays);
}

export function getActiveDaysBetween(
  startDate: Date,
  endDate: Date,
  pausePeriods: BookPausePeriod[] | undefined,
  now: Date,
): number {
  const totalDays = wholeDaysBetween(startOfLocalDay(startDate), startOfLocalDay(endDate));
  return Math.max(0, totalDays - getPauseDaysBetween(startDate, endDate, pausePeriods, now));
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

export function getCalendarPagesPerDay(params: {
  pages?: number;
  dateStarted?: string;
  dateEnded?: string;
  pausePeriods?: BookPausePeriod[];
  now?: Date;
}): number | null {
  const pages = params.pages ?? 0;
  const started = parseLocalDateOnly(params.dateStarted);
  const ended = params.dateEnded
    ? parseLocalDateOnly(params.dateEnded)
    : startOfLocalDay(params.now ?? new Date());

  if (pages <= 0 || !started || !ended || ended < started) return null;

  const elapsedDays = Math.max(
    1,
    getActiveDaysBetween(started, ended, params.pausePeriods, params.now ?? new Date()),
  );
  return pages / elapsedDays;
}

export function getPagesPerHour(params: {
  pages?: number;
  readingMinutes?: number;
}): number | null {
  const pages = params.pages ?? 0;
  const readingMinutes = params.readingMinutes ?? 0;
  if (pages <= 0 || readingMinutes <= 0) return null;

  return pages / (readingMinutes / 60);
}

export function formatPagesPerHour(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return `${value.toFixed(1)} pages/hour`;
}

export function buildProgressTimeline(
  logs: ReadingLog[],
  totalPages?: number,
  pausePeriods: BookPausePeriod[] = [],
): ProgressTimelineResult {
  if (!totalPages || totalPages <= 0) {
    return {
      isAvailable: false,
      points: [],
      pauseSegments: [],
    };
  }

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );
  let previousPage = 0;
  const progressByDay = new Map<string, number>();
  const validLogDays = new Set<string>();

  for (const log of sortedLogs) {
    const loggedAt = new Date(log.logged_at);
    if (!isValidDate(loggedAt)) continue;

    const currentPage = Math.max(0, log.current_page);
    const dayKey = toLocalDayKey(loggedAt);
    validLogDays.add(dayKey);

    const dayProgress = progressByDay.get(dayKey) ?? previousPage;
    const highestPageForDay = Math.max(dayProgress, currentPage);

    if (highestPageForDay > dayProgress) {
      progressByDay.set(dayKey, highestPageForDay);
    }

    previousPage = Math.max(previousPage, highestPageForDay);
  }

  const progressDays = [...progressByDay.entries()].sort(([dayA], [dayB]) =>
    dayA.localeCompare(dayB)
  );

  if (progressDays.length === 0) {
    return {
      isAvailable: true,
      points: [],
      pauseSegments: getPauseSegments(pausePeriods, new Date()),
    };
  }

  const loggedDays = [...validLogDays].sort();
  const firstDay = parseLocalDateOnly(loggedDays[0]);
  const lastDay = parseLocalDateOnly(loggedDays[loggedDays.length - 1]);
  if (!firstDay || !lastDay) {
    return {
      isAvailable: true,
      points: [],
      pauseSegments: getPauseSegments(pausePeriods, new Date()),
    };
  }

  const pauseSegments = getPauseSegments(pausePeriods, new Date());
  const latestPauseDay = pauseSegments.reduce((latest, segment) => {
    const end = parseLocalDateOnly(segment.endDayKey);
    if (!end) return latest;
    return !latest || end > latest ? end : latest;
  }, null as Date | null);
  const lastVisibleDay = latestPauseDay && latestPauseDay > lastDay ? latestPauseDay : lastDay;

  const progressPoints: ProgressTimelinePoint[] = [];
  const cursor = new Date(firstDay);
  let carriedPage = 0;

  while (cursor <= lastVisibleDay) {
    const dayKey = toLocalDayKey(cursor);
    const increasedPage = progressByDay.get(dayKey);
    const hasProgressIncrease = typeof increasedPage === "number" && increasedPage > carriedPage;
    if (hasProgressIncrease) {
      carriedPage = increasedPage;
    }

    progressPoints.push({
      dayKey,
      currentPage: carriedPage,
      progressPercent: Math.min(100, Math.round((carriedPage / totalPages) * 100)),
      isStart: false,
      hasProgressIncrease,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    isAvailable: true,
    points: [
      {
        dayKey: progressPoints[0].dayKey,
        currentPage: 0,
        progressPercent: 0,
        isStart: true,
        hasProgressIncrease: false,
      },
      ...progressPoints,
    ],
    pauseSegments,
  };
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
  pausePeriods?: BookPausePeriod[];
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

  const pausedDays = getPauseDaysBetween(started, endDate, params.pausePeriods, fallbackNow);
  const effectiveEndDate = new Date(endDate);
  effectiveEndDate.setDate(effectiveEndDate.getDate() - pausedDays);

  return {
    isAvailable: true,
    isInProgress,
    span: calculateCalendarSpan(started, effectiveEndDate),
  };
}

export function getEstimatedFinish(params: {
  status: BookStatus;
  currentPage?: number;
  totalPages?: number;
  logs: ReadingLog[];
  pausePeriods?: BookPausePeriod[];
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
  const loggedDays = getActiveDaysBetween(
    firstLogDate,
    lastLogDate,
    params.pausePeriods,
    params.now ?? new Date(),
  );
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
