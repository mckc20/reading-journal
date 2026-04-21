import type { ReadingLog } from "@/types";

const DAY_PARTS = [
  { label: "Morning", startHour: 6, endHour: 11 },
  { label: "Afternoon", startHour: 12, endHour: 17 },
  { label: "Evening", startHour: 18, endHour: 22 },
  { label: "Night", startHour: 23, endHour: 5 },
] as const;

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayPartLabel = (typeof DAY_PARTS)[number]["label"];

export interface DayPartStats {
  label: DayPartLabel;
  sessions: number;
  percentage: number;
}

export interface SpeedStats {
  averagePagesPerHour: number | null;
  sessionsUsed: number;
  totalPages: number;
  totalHours: number;
}

export interface DurationStats {
  averageMinutes: number | null;
  sessionsUsed: number;
}

export interface WeekdayStats {
  weekdayLabel: (typeof WEEKDAY_LABELS)[number];
  avgMinutesPerWeek: number;
  avgSessionsPerWeek: number;
  totalMinutes: number;
  totalSessions: number;
}

export interface ReadingHabitsMetrics {
  totalLogs: number;
  duration: DurationStats;
  speed: SpeedStats;
  usualTime: {
    dayParts: DayPartStats[];
    dominantHour: number | null;
    dominantHourLabel: string | null;
  };
  weekdays: {
    weekSpan: number;
    highest: WeekdayStats | null;
    lowest: WeekdayStats | null;
    all: WeekdayStats[];
  };
}

function getDayPartLabel(hour: number): DayPartLabel {
  if (hour >= 6 && hour <= 11) return "Morning";
  if (hour >= 12 && hour <= 17) return "Afternoon";
  if (hour >= 18 && hour <= 22) return "Evening";
  return "Night";
}

function toMondayFirstWeekdayIndex(jsDayIndex: number): number {
  return (jsDayIndex + 6) % 7;
}

function formatHourWindow(hour: number): string {
  const start = String(hour).padStart(2, "0");
  const end = String((hour + 1) % 24).padStart(2, "0");
  return `${start}:00-${end}:00`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekSpan(startIso: string, endIso: string): number {
  const start = startOfLocalDay(new Date(startIso));
  const end = startOfLocalDay(new Date(endIso));
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
  return Math.max(1, diffDays / 7);
}

export function calculateReadingHabits(
  logs: ReadingLog[],
  startIso: string,
  endIso: string
): ReadingHabitsMetrics {
  if (logs.length === 0) {
    return {
      totalLogs: 0,
      duration: {
        averageMinutes: null,
        sessionsUsed: 0,
      },
      speed: {
        averagePagesPerHour: null,
        sessionsUsed: 0,
        totalPages: 0,
        totalHours: 0,
      },
      usualTime: {
        dayParts: DAY_PARTS.map((part) => ({
          label: part.label,
          sessions: 0,
          percentage: 0,
        })),
        dominantHour: null,
        dominantHourLabel: null,
      },
      weekdays: {
        weekSpan: getWeekSpan(startIso, endIso),
        highest: null,
        lowest: null,
        all: WEEKDAY_LABELS.map((weekdayLabel) => ({
          weekdayLabel,
          avgMinutesPerWeek: 0,
          avgSessionsPerWeek: 0,
          totalMinutes: 0,
          totalSessions: 0,
        })),
      },
    };
  }

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  let durationMinutesTotal = 0;
  let durationSessions = 0;
  const dayPartSessionCounts = new Map<DayPartLabel, number>();
  const hourCounts = new Array<number>(24).fill(0);

  const weekdayMinutesTotal = new Array<number>(7).fill(0);
  const weekdaySessionsTotal = new Array<number>(7).fill(0);

  const logsByBook = new Map<string, ReadingLog[]>();

  for (const log of sortedLogs) {
    const loggedAt = new Date(log.logged_at);
    const hour = loggedAt.getHours();
    const dayPart = getDayPartLabel(hour);
    dayPartSessionCounts.set(dayPart, (dayPartSessionCounts.get(dayPart) ?? 0) + 1);
    hourCounts[hour] += 1;

    const weekdayIndex = toMondayFirstWeekdayIndex(loggedAt.getDay());
    weekdaySessionsTotal[weekdayIndex] += 1;

    const readingMinutes = log.reading_time_minutes ?? 0;
    if (readingMinutes > 0) {
      durationMinutesTotal += readingMinutes;
      durationSessions += 1;
      weekdayMinutesTotal[weekdayIndex] += readingMinutes;
    }

    const list = logsByBook.get(log.book_id) ?? [];
    list.push(log);
    logsByBook.set(log.book_id, list);
  }

  let speedTotalPages = 0;
  let speedTotalHours = 0;
  let speedSessions = 0;

  for (const bookLogs of logsByBook.values()) {
    const sortedBookLogs = [...bookLogs].sort(
      (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
    );

    for (let index = 1; index < sortedBookLogs.length; index += 1) {
      const current = sortedBookLogs[index];
      const previous = sortedBookLogs[index - 1];
      const readingMinutes = current.reading_time_minutes ?? 0;
      if (readingMinutes <= 0) continue;

      const pagesReadDelta = current.current_page - previous.current_page;
      if (pagesReadDelta <= 0) continue;

      const hours = readingMinutes / 60;
      if (hours <= 0) continue;

      speedTotalPages += pagesReadDelta;
      speedTotalHours += hours;
      speedSessions += 1;
    }
  }

  const totalSessions = sortedLogs.length;
  const dayPartStats: DayPartStats[] = DAY_PARTS.map((part) => {
    const sessions = dayPartSessionCounts.get(part.label) ?? 0;
    return {
      label: part.label,
      sessions,
      percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
    };
  });

  const maxHourCount = Math.max(...hourCounts);
  const dominantHour =
    maxHourCount > 0 ? hourCounts.findIndex((count) => count === maxHourCount) : null;

  const weekSpan = getWeekSpan(startIso, endIso);
  const weekdayStats: WeekdayStats[] = WEEKDAY_LABELS.map((weekdayLabel, index) => ({
    weekdayLabel,
    avgMinutesPerWeek: weekdayMinutesTotal[index] / weekSpan,
    avgSessionsPerWeek: weekdaySessionsTotal[index] / weekSpan,
    totalMinutes: weekdayMinutesTotal[index],
    totalSessions: weekdaySessionsTotal[index],
  }));

  const hasWeekdayActivity = weekdayStats.some((weekday) => weekday.totalSessions > 0);

  const highest = hasWeekdayActivity
    ? [...weekdayStats].sort((left, right) => {
        if (right.avgMinutesPerWeek !== left.avgMinutesPerWeek) {
          return right.avgMinutesPerWeek - left.avgMinutesPerWeek;
        }
        if (right.avgSessionsPerWeek !== left.avgSessionsPerWeek) {
          return right.avgSessionsPerWeek - left.avgSessionsPerWeek;
        }
        return WEEKDAY_LABELS.indexOf(left.weekdayLabel) - WEEKDAY_LABELS.indexOf(right.weekdayLabel);
      })[0]
    : null;

  const lowest = hasWeekdayActivity
    ? [...weekdayStats].sort((left, right) => {
        if (left.avgMinutesPerWeek !== right.avgMinutesPerWeek) {
          return left.avgMinutesPerWeek - right.avgMinutesPerWeek;
        }
        if (left.avgSessionsPerWeek !== right.avgSessionsPerWeek) {
          return left.avgSessionsPerWeek - right.avgSessionsPerWeek;
        }
        return WEEKDAY_LABELS.indexOf(left.weekdayLabel) - WEEKDAY_LABELS.indexOf(right.weekdayLabel);
      })[0]
    : null;

  return {
    totalLogs: totalSessions,
    duration: {
      averageMinutes: durationSessions > 0 ? durationMinutesTotal / durationSessions : null,
      sessionsUsed: durationSessions,
    },
    speed: {
      averagePagesPerHour: speedTotalHours > 0 ? speedTotalPages / speedTotalHours : null,
      sessionsUsed: speedSessions,
      totalPages: speedTotalPages,
      totalHours: speedTotalHours,
    },
    usualTime: {
      dayParts: dayPartStats,
      dominantHour,
      dominantHourLabel: dominantHour === null ? null : formatHourWindow(dominantHour),
    },
    weekdays: {
      weekSpan,
      highest,
      lowest,
      all: weekdayStats,
    },
  };
}

export function formatDurationMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  return `${rounded} min`;
}

export function formatPagesPerHour(pagesPerHour: number): string {
  return `${pagesPerHour.toFixed(1)} pages/hr`;
}

export function formatMinutesCompact(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}
