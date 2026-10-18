import { localDate, shiftMonth, type MonthlyReport, type ReportBook, type ReportJournalEntry } from './wrapUpReports.js';
import { validCalendarDate, type WrapUpArchive } from './wrapUpArchive.js';

export function defaultWrapUpMonth(archive: WrapUpArchive, now = new Date()): string | undefined {
  const previous = shiftMonth(localDate(now, archive.timezone).slice(0, 7), -1);
  return archive.months.find(month => month.key === previous)?.key
    ?? archive.months.map(month => month.key).sort().reverse()[0];
}

/** Keep the selected month when possible; otherwise use that year's latest available month. */
export function wrapUpMonthInYear(keys: string[], year: string, month: string): string | undefined {
  const available = keys.filter(key => key.startsWith(`${year}-`)).sort();
  return available.find(key => key.slice(5) === month) ?? available[available.length - 1];
}

/** Prefer a Saved entry, then the latest dated entry, without changing the snapshot. */
export function featuredJournalEntry(entries: ReportJournalEntry[]): ReportJournalEntry | undefined {
  return [...entries].sort((a, b) => Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite))
    || b.entry_date.localeCompare(a.entry_date) || a.id.localeCompare(b.id))[0];
}

/** Describe saved dates relative to the report month, rather than today's status. */
export function bookMonthContext(book: Pick<ReportBook, 'date_started' | 'date_finished'>, monthKey: string): string {
  const start = `${monthKey}-01`;
  const end = `${shiftMonth(monthKey, 1)}-01`;
  if (validCalendarDate(book.date_finished) && book.date_finished < end) {
    return book.date_finished < start ? 'Finished before this month' : 'Finished this month';
  }
  if (validCalendarDate(book.date_started) && book.date_started < end) {
    return `${book.date_started >= start ? 'Started this month' : 'Started earlier'} · Not finished by month-end`;
  }
  return 'Start date not recorded for this month · No finish recorded by month-end';
}

/** Fill calendar slots without turning missing observations into zero reading. */
export function buildReportCalendar(monthKey: string, activity: NonNullable<MonthlyReport['dailyActivity']>) {
  const observed = new Map(activity.map(day => [day.date, day]));
  const endDate = `${shiftMonth(monthKey, 1)}-01`;
  const days: { date: string; pagesLogged: number | null; minutesLogged: number | null }[] = [];
  const cursor = new Date(`${monthKey}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) < endDate) {
    const date = cursor.toISOString().slice(0, 10);
    days.push(observed.get(date) ?? { date, pagesLogged: null, minutesLogged: null });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
