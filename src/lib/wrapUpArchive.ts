import { localDate, resolveTimezone, shiftMonth, type MonthlyReport } from './wrapUpReports.js';

export interface SavedMonthlyReport {
  id: string; user_id: string; period_type: 'monthly'; period_key: string;
  snapshot: MonthlyReport; is_historical: boolean; source_as_of: string; created_at: string;
}
export interface ArchiveMonth {
  key: string;
  saved: boolean;
  booksFinished?: number;
}
export interface WrapUpArchive {
  months: ArchiveMonth[];
  timezone: string;
  timezoneFallback: boolean;
}
export interface HistoryBook {
  date_started: string | null;
  date_finished: string | null;
  created_at: string | null;
}
export interface ReportSummary {
  period_key: string;
  booksFinished?: number;
}

export function validCalendarDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Calendar reading dates can predate the day a book was added to the app. */
export function buildWrapUpArchive(books: HistoryBook[], logs: { logged_at: string }[], saved: ReportSummary[], timezone: string | null, now = new Date(), journalEntries: { entry_date: string }[] = []): WrapUpArchive {
  const zone = resolveTimezone(timezone);
  const current = localDate(now, zone.timezone).slice(0, 7);
  const candidates: string[] = [];
  const timestampMonth = (value: string | null) => {
    if (value && Number.isFinite(Date.parse(value))) candidates.push(localDate(new Date(value), zone.timezone).slice(0, 7));
  };
  for (const book of books) {
    for (const date of [book.date_started, book.date_finished]) {
      if (validCalendarDate(date)) candidates.push(date.slice(0, 7));
    }
    timestampMonth(book.created_at);
  }
  logs.forEach(log => timestampMonth(log.logged_at));
  journalEntries.forEach(entry => {
    if (validCalendarDate(entry.entry_date)) candidates.push(entry.entry_date.slice(0, 7));
  });
  const summaries = new Map(saved.map(report => [report.period_key, report]));
  const first = candidates.filter(key => key >= '0001-02' && key < current).sort()[0];
  const keys = new Set(saved.map(report => report.period_key));
  if (first) {
    for (let key = first; key < current; key = shiftMonth(key, 1)) keys.add(key);
  }
  // A timezone change can make a saved completed month look current locally.
  // Keep it accessible; only unsaved months must precede the current month.
  return { ...zone, months: [...keys].filter(key => key < current || summaries.has(key)).sort().reverse().map(key => ({
    key, saved: summaries.has(key), ...(summaries.has(key) ? { booksFinished: summaries.get(key)!.booksFinished } : {}),
  })) };
}

export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
}
