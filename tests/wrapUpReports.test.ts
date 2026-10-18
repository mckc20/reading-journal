import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthlyReport, monthlyPeriod, type ReportBook, type ReportLog } from '../src/lib/wrapUpReports.js';
import { generateMonthlyReport, reportRepository, type ReportRepository, type SavedMonthlyReport } from '../api/_lib/wrapUpReports.js';

const user = 'owner';
const book = (changes: Partial<ReportBook> = {}): ReportBook => ({ id: 'book', user_id: user, title: 'A book', authors: ['Writer'], genres: ['Fantasy'], total_pages: 300, cover_url: null, rating: 5, format: 'Paperback', language: 'English', date_started: '2026-01-01', date_finished: '2026-03-10', ...changes });
const log = (id: string, date: string, page: number, minutes: number | null = null): ReportLog => ({ id, user_id: user, book_id: 'book', current_page: page, reading_time_minutes: minutes, logged_at: date });
const period = monthlyPeriod('2026-03', 'Europe/Vienna');

test('monthly totals use earlier baselines, high-water corrections, and separate completion from activity', () => {
  const report = buildMonthlyReport(user, period, [book(), book({ id: 'unlogged', rating: null })], [
    log('before', '2026-02-28T12:00:00Z', 100, 15),
    log('correction', '2026-03-01T12:00:00Z', 80),
    log('next', '2026-03-02T12:00:00Z', 110, 20),
    log('more', '2026-03-02T13:00:00Z', 140, 0),
  ]);
  assert.deepEqual(report.totals, { booksFinished: 2, pagesLogged: 40, minutesLogged: 20, readingDays: 1 });
  assert.equal(report.coverage.finishedWithoutLogs, 1);
  assert.equal(report.coverage.missingMinutes, 1);
  assert.equal(report.previousMonth.totals.pagesLogged, 100);
  assert.equal(report.previousMonth.differences.pagesLogged, -60);
  assert.equal(report.highlights.highestRatedBook?.id, 'book');
  assert.deepEqual(report.highlights.mostPagesDay, { date: '2026-03-02', pages: 40 });
});

test('missing observations stay unavailable; explicit zero stays zero; unsupported highlights omitted', () => {
  const empty = buildMonthlyReport(user, period, [book({ rating: null })], []);
  assert.deepEqual(empty.totals, { booksFinished: 1, pagesLogged: null, minutesLogged: null, readingDays: null });
  assert.deepEqual(empty.highlights, {});
  assert.equal(empty.previousMonth.differences.pagesLogged, null);
  const zero = buildMonthlyReport(user, period, [book({ rating: null })], [log('zero', '2026-03-02T12:00:00Z', 0, 0)]);
  assert.deepEqual(zero.totals, { booksFinished: 1, pagesLogged: 0, minutesLogged: 0, readingDays: 0 });
  assert.deepEqual(zero.highlights, {});
});

test('first log counts from zero, audiobooks use recorded minutes without page conversion', () => {
  const report = buildMonthlyReport(user, period, [book({ format: 'Audiobook', date_finished: null })], [log('first', '2026-03-02T12:00:00Z', 100, 30)]);
  assert.equal(report.totals.pagesLogged, 100);
  assert.equal(report.totals.minutesLogged, 30);
  assert.equal(report.activeBooks.length, 1);
});

test('DST, leap years, year rollover, fallback and exclusive end boundaries', () => {
  assert.equal(period.startAt, '2026-02-28T23:00:00.000Z');
  assert.equal(period.endAt, '2026-03-31T22:00:00.000Z');
  const october = monthlyPeriod('2026-10', 'Europe/Vienna');
  assert.equal(october.endAt, '2026-10-31T23:00:00.000Z');
  assert.equal(monthlyPeriod('2024-02', 'UTC').endDate, '2024-03-01');
  assert.equal(monthlyPeriod('2026-12', 'UTC').endDate, '2027-01-01');
  assert.equal(monthlyPeriod('2026-03', 'bad-zone').timezoneFallback, true);
  assert.equal(monthlyPeriod('2026-03').timezone, 'UTC');
  const report = buildMonthlyReport(user, period, [book()], [
    log('start', period.startAt, 10, 10), log('end', period.endAt, 20, 10),
  ]);
  assert.equal(report.totals.pagesLogged, 10);
  assert.equal(report.highlights.mostPagesDay?.date, '2026-03-01');
  assert.throws(() => monthlyPeriod('2026-13'), /Invalid month/);
});

test('invalid dates are flagged and current book state is never used as historical evidence', () => {
  const report = buildMonthlyReport(user, period, [book({ date_finished: '2026-02-30' })], [log('bad', 'invalid', 999)]);
  assert.equal(report.totals.booksFinished, 0);
  assert.equal(report.coverage.invalidLogDates, 1);
  assert.equal(report.coverage.invalidBookDates, 1);
  assert.deepEqual(report.activeBooks, []);
});

test('snapshot detaches metadata and rejects foreign users and foreign book references', () => {
  const source = book();
  const report = buildMonthlyReport(user, period, [source], []);
  source.title = 'Changed'; source.authors.push('New author'); source.rating = 1;
  assert.equal(report.finishedBooks[0].title, 'A book');
  assert.deepEqual(report.finishedBooks[0].authors, ['Writer']);
  assert.equal(report.finishedBooks[0].rating, 5);
  assert.throws(() => buildMonthlyReport('other', period, [source], []), /ownership/);
  assert.throws(() => buildMonthlyReport(user, period, [], [log('foreign', period.startAt, 1)]), /ownership/);
});

function memoryRepository() {
  let saved: SavedMonthlyReport | null = null;
  let timezone: string | null = 'Europe/Vienna';
  let sources = 0;
  const repository: ReportRepository = {
    async find(owner, key) { return saved?.user_id === owner && saved.period_key === key ? saved : null; },
    async timezone() { return timezone; },
    async sources() { sources++; return { books: [book()], logs: [] }; },
    async insert(row) {
      if (saved) throw { code: '23505' };
      saved = JSON.parse(JSON.stringify({ ...row, id: 'report', created_at: '2026-04-01T00:00:00Z' }));
      return saved!;
    },
  };
  return { repository, changeTimezone() { timezone = 'America/New_York'; }, sources: () => sources };
}

test('overlapping generation returns one winner; repeat calls preserve snapshot and timezone', async () => {
  const memory = memoryRepository();
  const options = { repository: memory.repository, now: new Date('2026-04-01T01:00:00Z') };
  const reports = await Promise.all([generateMonthlyReport(user, '2026-03', options), generateMonthlyReport(user, '2026-03', options)]);
  assert.deepEqual(reports[0], reports[1]);
  assert.equal(reports[0].is_historical, false);
  memory.changeTimezone();
  const calls = memory.sources();
  const again = await generateMonthlyReport(user, '2026-03', options);
  assert.equal(again.snapshot.period.timezone, 'Europe/Vienna');
  assert.equal(memory.sources(), calls);
});

test('historical classification, incomplete months, and source failures', async () => {
  const { repository } = memoryRepository();
  await assert.rejects(generateMonthlyReport(user, '2026-03', { repository, now: new Date('2026-03-15') }), /completed/);
  const report = await generateMonthlyReport(user, '2026-03', { repository, now: new Date('2026-05-01') });
  assert.equal(report.is_historical, true);
  const broken = memoryRepository().repository;
  broken.sources = async () => { throw new Error('source failure'); };
  await assert.rejects(generateMonthlyReport(user, '2026-03', { repository: broken, now: new Date('2026-05-01') }), /source failure/);
  assert.equal(await broken.find(user, '2026-03'), null);
});

test('admin source queries paginate and explicitly filter both tables by owner', async () => {
  const calls: { table: string; owner?: string; from?: number }[] = [];
  const admin = { from(table: string) {
    const call: { table: string; owner?: string; from?: number } = { table }; calls.push(call);
    const query = {
      select() { return query; }, eq(column: string, value: string) { assert.equal(column, 'user_id'); call.owner = value; return query; },
      order() { return query; }, async range(from: number) {
        call.from = from;
        return { error: null, data: table === 'books' && from === 0 ? Array.from({ length: 500 }, (_, i) => ({ ...book({ id: String(i) }), book_authors: [], book_genres: [] })) : [] };
      },
    }; return query;
  } };
  const source = await reportRepository(admin as never).sources(user);
  assert.equal(source.books.length, 500);
  assert.deepEqual(calls.map(c => [c.table, c.owner, c.from]), [['books', user, 0], ['books', user, 500], ['reading_logs', user, 0], ['book_journal', user, 0]]);
});

test('local reading days merge UTC dates and audiobook minutes establish activity without pages', () => {
  const report = buildMonthlyReport(user, monthlyPeriod('2026-03', 'America/New_York'), [book({ format: 'Audiobook' })], [
    log('evening', '2026-03-03T02:00:00Z', 0, 20),
    log('afternoon', '2026-03-02T21:00:00Z', 0, 10),
  ]);
  assert.equal(report.totals.readingDays, 1);
  assert.equal(report.totals.minutesLogged, 30);
  assert.equal(report.totals.pagesLogged, 0);
  assert.equal(report.highlights.mostPagesDay, undefined);
});

test('service-role metadata joins reject a foreign author even on an owned book', async () => {
  const admin = { from(table: string) {
    const query = {
      select() { return query; }, eq() { return query; }, order() { return query; },
      async range() { return { error: null, data: table === 'books' ? [{ ...book(), book_genres: [], book_authors: [{ position: 0, authors: { name: 'Private author', user_id: 'other' } }] }] : [] }; },
    }; return query;
  } };
  await assert.rejects(reportRepository(admin as never).sources(user), /metadata ownership/);
});

test('daily activity uses local dates, preceding baselines and preserves missing versus zero minutes', () => {
  const report = buildMonthlyReport(user, monthlyPeriod('2026-03', 'America/New_York'), [book()], [
    log('baseline', '2026-02-28T12:00:00Z', 100, 60),
    log('afternoon', '2026-03-02T21:00:00Z', 120, null),
    log('evening', '2026-03-03T02:00:00Z', 130, null),
    log('correction', '2026-03-03T12:00:00Z', 110, 0),
    log('timed', '2026-03-04T12:00:00Z', 140, 20),
  ]);
  assert.deepEqual(report.dailyActivity, [
    { date: '2026-03-02', pagesLogged: 30, minutesLogged: null },
    { date: '2026-03-03', pagesLogged: 0, minutesLogged: 0 },
    { date: '2026-03-04', pagesLogged: 10, minutesLogged: 20 },
  ]);
  assert.equal(report.dailyActivity!.reduce((sum, day) => sum + day.pagesLogged, 0), report.totals.pagesLogged);
  assert.equal(report.dailyActivity!.reduce((sum, day) => sum + (day.minutesLogged ?? 0), 0), report.totals.minutesLogged);
  assert.deepEqual(buildMonthlyReport(user, period, [], []).dailyActivity, []);
});

test('other books carry logged evidence and dated journal entries without changing reading totals', () => {
  const books = [book(), book({ id: 'ongoing', date_finished: null }), book({ id: 'journal-only', date_finished: '2026-02-01' })];
  const entry = {
    id: 'journal', user_id: user, book_id: 'journal-only', label: 'note' as const,
    content: 'A reflection on this book.', attribution: null, entry_date: '2026-03-07',
  };
  const report = buildMonthlyReport(user, period, books, [
    { ...log('before', '2026-02-28T12:00:00Z', 100, 20), book_id: 'ongoing' },
    { ...log('current', '2026-03-02T12:00:00Z', 130), book_id: 'ongoing' },
  ], [entry, { ...entry, id: 'outside', entry_date: '2026-04-01' }, { ...entry, id: 'finished-note', book_id: 'book' }]);
  assert.deepEqual(report.otherBookActivity?.map(item => item.book.id), ['journal-only', 'ongoing']);
  const journalOnly = report.otherBookActivity![0];
  assert.equal(journalOnly.logCount, 0);
  assert.equal(journalOnly.pagesLogged, null);
  assert.equal(journalOnly.minutesLogged, null);
  assert.deepEqual(journalOnly.journalEntries, [entry]);
  const ongoing = report.otherBookActivity![1];
  assert.equal(ongoing.pagesLogged, 30);
  assert.equal(ongoing.minutesLogged, null);
  assert.equal(ongoing.logCount, 1);
  assert.equal(report.totals.booksFinished, 1);
  assert.equal(report.totals.readingDays, 1);
  assert.deepEqual(report.activeBooks.map(book => book.id), ['ongoing']);
  entry.content = 'Edited later';
  assert.equal(journalOnly.journalEntries[0].content, 'A reflection on this book.');
});

test('journal ownership and book ownership are checked before snapshot creation', () => {
  const entry = { id: 'entry', user_id: 'other', book_id: 'book', label: 'note' as const, content: 'Private', attribution: null, entry_date: '2026-03-02' };
  assert.throws(() => buildMonthlyReport(user, period, [book()], [], [entry]), /ownership/);
  assert.throws(() => buildMonthlyReport(user, period, [book()], [], [{ ...entry, user_id: user, book_id: 'foreign-book' }]), /ownership/);
});

test('finished-book context preserves reading totals and saved journal entries for the featured layout', () => {
  const entry = {
    id: 'quote', user_id: user, book_id: 'book', label: 'quote' as const,
    content: 'A saved passage.', attribution: 'Writer', entry_date: '2026-03-07', is_favorite: true,
  };
  const report = buildMonthlyReport(user, period, [book()], [
    log('before', '2026-02-28T12:00:00Z', 100, 15),
    log('march', '2026-03-02T12:00:00Z', 140, 30),
  ], [entry, { ...entry, id: 'outside', entry_date: '2026-04-01' }]);
  assert.equal(report.finishedBookActivity?.length, 1);
  const context = report.finishedBookActivity![0];
  assert.equal(context.book.id, report.finishedBooks[0].id);
  assert.equal(context.pagesLogged, 40);
  assert.equal(context.minutesLogged, 30);
  assert.equal(context.logCount, 1);
  assert.deepEqual(context.journalEntries, [entry]);
  assert.deepEqual(report.otherBookActivity, []);
  entry.content = 'Changed later'; entry.is_favorite = false;
  assert.equal(context.journalEntries[0].content, 'A saved passage.');
  assert.equal(context.journalEntries[0].is_favorite, true);
});

test('favorite books outrank five-star books, with star ratings breaking ties between favorites', () => {
  const favorite = book({ id: 'favorite', rating: 3, is_favorite: true });
  const report = buildMonthlyReport(user, period, [book({ id: 'five-stars', rating: 5 }), favorite], []);
  assert.equal(report.highlights.highestRatedBook?.id, 'favorite');
  assert.equal(report.highlights.highestRatedBook?.rating, 3);
  favorite.is_favorite = false;
  assert.equal(report.highlights.highestRatedBook?.is_favorite, true);
  const tied = buildMonthlyReport(user, period, [
    book({ id: 'favorite-three', rating: 3, is_favorite: true }),
    book({ id: 'favorite-five', rating: 5, is_favorite: true }),
  ], []);
  assert.equal(tied.highlights.highestRatedBook?.id, 'favorite-five');
});

test('unrated favorites are eligible, but unsupported ratings alone and out-of-month favorites are not', () => {
  const report = buildMonthlyReport(user, period, [
    book({ id: 'unrated-favorite', rating: null, is_favorite: true }),
    book({ id: 'ordinary', rating: 5 }),
    book({ id: 'outside', is_favorite: true, date_finished: '2026-02-28' }),
  ], []);
  assert.equal(report.highlights.highestRatedBook?.id, 'unrated-favorite');
  assert.equal(report.highlights.highestRatedBook?.rating, null);
  assert.equal(buildMonthlyReport(user, period, [book({ rating: 99 })], []).highlights.highestRatedBook, undefined);
});
