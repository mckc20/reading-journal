import { readingPageDeltas } from './readingPageDeltas.js';

export type ReportPeriodType = 'monthly' | 'yearly';
export interface ReportPeriod {
  type: 'monthly'; key: string; timezone: string; timezoneFallback: boolean;
  startDate: string; endDate: string; startAt: string; endAt: string;
}
export interface ReportBook {
  id: string; user_id: string; title: string; authors: string[]; genres: string[];
  total_pages: number | null; cover_url: string | null; rating: number | null; format: string | null; language: string | null;
  date_started: string | null; date_finished: string | null;
  /** Optional for snapshots created before favorite-book priority was added. */
  is_favorite?: boolean;
}
export interface ReportLog {
  id: string; user_id: string; book_id: string; current_page: number;
  reading_time_minutes: number | null; logged_at: string;
}
export interface ReportJournalEntry {
  id: string; user_id: string; book_id: string; label: 'note' | 'quote' | 'review';
  content: string; attribution: string | null; entry_date: string;
  /** Optional for reports created before saved-entry preference was captured. */
  is_favorite?: boolean;
}
export interface ReportBookActivity {
  book: ReportBook;
  pagesLogged: number | null;
  minutesLogged: number | null;
  logCount: number;
  journalEntries: ReportJournalEntry[];
}
export interface ReportTotals {
  booksFinished: number; pagesLogged: number | null; minutesLogged: number | null; readingDays: number | null;
}
export interface MonthlyReport {
  version: 1; period: ReportPeriod; totals: ReportTotals; finishedBooks: ReportBook[];
  /** Absent on snapshots saved before the archive was introduced. */
  dailyActivity?: { date: string; pagesLogged: number; minutesLogged: number | null }[];
  /** Positive logged activity, not a reconstructed historical status. */
  activeBooks: ReportBook[];
  /** Context saved at generation time; absent in older snapshots. */
  otherBookActivity?: ReportBookActivity[];
  /** Finished-book context for the featured single-book layout; absent in older reports. */
  finishedBookActivity?: ReportBookActivity[];
  coverage: { logs: number; missingMinutes: number; invalidLogDates: number; invalidBookDates: number; finishedWithoutLogs: number };
  highlights: { highestRatedBook?: ReportBook; longestSession?: { bookId: string; minutes: number }; mostPagesDay?: { date: string; pages: number } };
  previousMonth: { period: ReportPeriod; totals: ReportTotals; differences: Record<keyof ReportTotals, number | null> };
}

export function localDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function resolveTimezone(value?: string | null) {
  try {
    if (!value) throw new Error('Missing timezone');
    return { timezone: new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone, timezoneFallback: false };
  } catch { return { timezone: 'UTC', timezoneFallback: true }; }
}

export function shiftMonth(key: string, offset: number): string {
  const date = new Date(`${key}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

// Find the first instant of the local calendar date, including midnight offset changes.
function dateBoundary(date: string, timezone: string): string {
  const center = Date.parse(`${date}T00:00:00Z`);
  let low = center - 48 * 3600000, high = center + 48 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(new Date(middle), timezone) < date) low = middle + 1;
    else high = middle;
  }
  return new Date(low).toISOString();
}

export function monthlyPeriod(key: string, timezone?: string | null): ReportPeriod {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || key < '0001-01' || key > '9998-12') throw new Error('Invalid month key');
  const zone = resolveTimezone(timezone);
  const startDate = `${key}-01`, endDate = `${shiftMonth(key, 1)}-01`;
  return { type: 'monthly', key, ...zone, startDate, endDate,
    startAt: dateBoundary(startDate, zone.timezone), endAt: dateBoundary(endDate, zone.timezone) };
}

function validDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function calculate(period: ReportPeriod, books: ReportBook[], logs: ReportLog[], journalEntries: ReportJournalEntry[]) {
  const within = (value: string) => value >= period.startDate && value < period.endDate;
  const entries = readingPageDeltas(logs).filter(({ log }) => log.logged_at && Date.parse(log.logged_at) >= Date.parse(period.startAt) && Date.parse(log.logged_at) < Date.parse(period.endAt));
  const finishedBooks = books.filter(book => validDate(book.date_finished) && within(book.date_finished)).sort((a,b) => a.id.localeCompare(b.id));
  const activeIds = new Set(entries.filter(e => e.pages > 0 || (e.log.reading_time_minutes ?? 0) > 0).map(e => e.log.book_id));
  const activeBooks = books.filter(book => activeIds.has(book.id) && (!validDate(book.date_finished) || book.date_finished >= period.endDate)).sort((a,b) => a.id.localeCompare(b.id));
  const monthJournal = journalEntries.filter(entry => validDate(entry.entry_date) && within(entry.entry_date))
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.id.localeCompare(b.id));
  const journalBookIds = new Set(monthJournal.map(entry => entry.book_id));
  const finishedIds = new Set(finishedBooks.map(book => book.id));
  const activityForBook = (book: ReportBook): ReportBookActivity => {
    const bookLogs = entries.filter(entry => entry.log.book_id === book.id);
    const timedLogs = bookLogs.filter(entry => entry.log.reading_time_minutes !== null
      && Number.isFinite(entry.log.reading_time_minutes) && entry.log.reading_time_minutes >= 0);
    return {
      book,
      logCount: bookLogs.length,
      pagesLogged: bookLogs.length ? bookLogs.reduce((sum, entry) => sum + entry.pages, 0) : null,
      minutesLogged: timedLogs.length ? timedLogs.reduce((sum, entry) => sum + entry.log.reading_time_minutes!, 0) : null,
      journalEntries: monthJournal.filter(entry => entry.book_id === book.id),
    };
  };
  const finishedBookActivity = finishedBooks.map(activityForBook);
  const otherBookActivity = books
    .filter(book => !finishedIds.has(book.id) && (activeIds.has(book.id) || journalBookIds.has(book.id)))
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .map(activityForBook);
  const timed = entries.filter(e => e.log.reading_time_minutes !== null && Number.isFinite(e.log.reading_time_minutes) && e.log.reading_time_minutes >= 0);
  const days = new Map<string, number>();
  for (const { log, pages } of entries) {
    if (pages > 0 || (log.reading_time_minutes ?? 0) > 0) {
      const day = localDate(new Date(log.logged_at), period.timezone);
      days.set(day, (days.get(day) ?? 0) + pages);
    }
  }
  const totals: ReportTotals = {
    booksFinished: finishedBooks.length,
    pagesLogged: entries.length ? entries.reduce((sum,e) => sum + e.pages, 0) : null,
    minutesLogged: timed.length ? timed.reduce((sum,e) => sum + e.log.reading_time_minutes!, 0) : null,
    readingDays: entries.length ? days.size : null,
  };
  const activity = new Map<string, { date: string; pagesLogged: number; minutesLogged: number | null }>();
  for (const { log, pages } of entries) {
    const date = localDate(new Date(log.logged_at), period.timezone);
    const day = activity.get(date) ?? { date, pagesLogged: 0, minutesLogged: null };
    day.pagesLogged += pages;
    if (log.reading_time_minutes !== null && Number.isFinite(log.reading_time_minutes) && log.reading_time_minutes >= 0) {
      day.minutesLogged = (day.minutesLogged ?? 0) + log.reading_time_minutes;
    }
    activity.set(date, day);
  }
  const dailyActivity = [...activity.values()].sort((a, b) => a.date.localeCompare(b.date));
  const ratingValue = (book: ReportBook) => book.rating !== null && book.rating >= 1 && book.rating <= 5 ? book.rating : 0;
  const highestRatedBook = finishedBooks.filter(book => book.is_favorite === true || ratingValue(book) > 0)
    .sort((a, b) => Number(b.is_favorite === true) - Number(a.is_favorite === true)
      || ratingValue(b) - ratingValue(a) || a.id.localeCompare(b.id))[0];
  const longest = [...timed].filter(e => e.log.reading_time_minutes! > 0).sort((a,b) => b.log.reading_time_minutes! - a.log.reading_time_minutes! || a.log.id.localeCompare(b.log.id))[0];
  const bestDay = [...days].filter(([,pages]) => pages > 0).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))[0];
  const highlights: MonthlyReport['highlights'] = {};
  if (highestRatedBook) highlights.highestRatedBook = highestRatedBook;
  if (longest) highlights.longestSession = { bookId: longest.log.book_id, minutes: longest.log.reading_time_minutes! };
  if (bestDay) highlights.mostPagesDay = { date: bestDay[0], pages: bestDay[1] };
  return { totals, dailyActivity, finishedBooks, finishedBookActivity, activeBooks, otherBookActivity, highlights, coverage: {
    logs: entries.length, missingMinutes: entries.length - timed.length,
    invalidLogDates: logs.filter(log => !Number.isFinite(Date.parse(log.logged_at))).length,
    invalidBookDates: books.filter(book => (book.date_finished !== null && !validDate(book.date_finished)) || (book.date_started !== null && !validDate(book.date_started))).length,
    finishedWithoutLogs: finishedBooks.filter(book => !entries.some(e => e.log.book_id === book.id)).length,
  } };
}

export function buildMonthlyReport(userId: string, period: ReportPeriod, books: ReportBook[], logs: ReportLog[], journalEntries: ReportJournalEntry[] = []): MonthlyReport {
  const owned = new Set(books.map(book => book.id));
  if (books.some(book => book.user_id !== userId)
    || [...logs, ...journalEntries].some(source => source.user_id !== userId || !owned.has(source.book_id))) throw new Error('Report source ownership mismatch');
  const previousPeriod = monthlyPeriod(shiftMonth(period.key, -1), period.timezone);
  const current = calculate(period, books, logs, journalEntries), previous = calculate(previousPeriod, books, logs, []);
  const differences = Object.fromEntries((Object.keys(current.totals) as (keyof ReportTotals)[]).map(key => [key,
    current.totals[key] === null || previous.totals[key] === null ? null : current.totals[key]! - previous.totals[key]!,
  ])) as Record<keyof ReportTotals, number | null>;
  // Detach all metadata from caller-owned objects before returning the snapshot.
  return JSON.parse(JSON.stringify({ version: 1, period, ...current, previousMonth: { period: previousPeriod, totals: previous.totals, differences } }));
}
