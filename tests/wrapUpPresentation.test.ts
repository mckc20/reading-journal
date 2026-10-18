import assert from 'node:assert/strict';
import test from 'node:test';
import { bookMonthContext, buildReportCalendar, defaultWrapUpMonth, featuredJournalEntry, wrapUpMonthInYear } from '../src/lib/wrapUpPresentation.js';

test('desktop opens last completed month in the archive timezone, ahead of newer saved exceptions', () => {
  const months = ['2026-02', '2026-04', '2026-03'].map(key => ({ key, saved: true }));
  const archive = { months, timezone: 'America/Los_Angeles', timezoneFallback: false };
  // Still March locally: February is the last completed month.
  assert.equal(defaultWrapUpMonth(archive, new Date('2026-04-01T00:30:00Z')), '2026-02');
  assert.equal(defaultWrapUpMonth({ ...archive, timezone: 'Europe/Vienna' }, new Date('2026-04-01T00:30:00Z')), '2026-03');
});

test('desktop falls back to newest available month, including empty history and year boundaries', () => {
  const archive = { months: [{ key: '2025-11', saved: true }, { key: '2025-12', saved: false }], timezone: 'UTC', timezoneFallback: false };
  assert.equal(defaultWrapUpMonth(archive, new Date('2026-01-10')), '2025-12');
  assert.equal(defaultWrapUpMonth(archive, new Date('2026-04-10')), '2025-12');
  assert.equal(defaultWrapUpMonth({ ...archive, months: [] }), undefined);
});

test('year chooser retains available months and otherwise selects that year’s newest month', () => {
  const keys = ['2026-03', '2026-01', '2025-12', '2025-03'];
  assert.equal(wrapUpMonthInYear(keys, '2025', '03'), '2025-03');
  assert.equal(wrapUpMonthInYear(keys, '2025', '01'), '2025-12');
  assert.equal(wrapUpMonthInYear(keys, '2026', '12'), '2026-03');
  assert.equal(wrapUpMonthInYear(keys, '2024', '01'), undefined);
});

test('calendar includes every day without inventing observations for gaps', () => {
  const calendar = buildReportCalendar('2026-03', [
    { date: '2026-03-03', pagesLogged: 25, minutesLogged: null },
    { date: '2026-03-05', pagesLogged: 0, minutesLogged: 0 },
  ]);
  assert.equal(calendar.length, 31);
  assert.deepEqual(calendar[0], { date: '2026-03-01', pagesLogged: null, minutesLogged: null });
  assert.deepEqual(calendar[2], { date: '2026-03-03', pagesLogged: 25, minutesLogged: null });
  assert.deepEqual(calendar[4], { date: '2026-03-05', pagesLogged: 0, minutesLogged: 0 });
  assert.equal(calendar.at(-1)?.date, '2026-03-31');
});

test('empty calendars respect leap years and year boundaries', () => {
  assert.equal(buildReportCalendar('2024-02', []).length, 29);
  assert.equal(buildReportCalendar('2026-02', []).length, 28);
  assert.equal(buildReportCalendar('2026-12', []).at(-1)?.date, '2026-12-31');
});

test('book context distinguishes new starts from continued books at month-end', () => {
  assert.equal(bookMonthContext({ date_started: '2026-03-01', date_finished: null }, '2026-03'),
    'Started this month · Not finished by month-end');
  assert.equal(bookMonthContext({ date_started: '2026-03-31', date_finished: '2026-04-02' }, '2026-03'),
    'Started this month · Not finished by month-end');
  assert.equal(bookMonthContext({ date_started: '2026-02-28', date_finished: null }, '2026-03'),
    'Started earlier · Not finished by month-end');
});

test('journal activity on a previously finished book never labels it unfinished', () => {
  assert.equal(bookMonthContext({ date_started: '2026-01-01', date_finished: '2026-02-28' }, '2026-03'),
    'Finished before this month');
});

test('missing, invalid, or later start dates do not claim a start during the month', () => {
  for (const date_started of [null, '2026-02-30', '2026-04-01']) {
    assert.equal(bookMonthContext({ date_started, date_finished: null }, '2026-03'),
      'Start date not recorded for this month · No finish recorded by month-end');
  }
});

test('a Saved journal entry takes priority over a newer unsaved entry', () => {
  const base = { user_id: 'owner', book_id: 'book', label: 'note' as const, content: 'An entry', attribution: null };
  const saved = { ...base, id: 'saved', entry_date: '2026-03-01', is_favorite: true };
  const recent = { ...base, id: 'recent', entry_date: '2026-03-20', is_favorite: false };
  const entries = [recent, saved];
  assert.equal(featuredJournalEntry(entries)?.id, 'saved');
  assert.deepEqual(entries, [recent, saved]);
  assert.equal(featuredJournalEntry([saved, { ...saved, id: 'newer-saved', entry_date: '2026-03-02' }])?.id, 'newer-saved');
});

test('journal selection works with legacy entries, ties, and no entries', () => {
  const base = { user_id: 'owner', book_id: 'book', label: 'quote' as const, content: 'A quote', attribution: null };
  assert.equal(featuredJournalEntry([
    { ...base, id: 'old', entry_date: '2026-03-01' },
    { ...base, id: 'b', entry_date: '2026-03-02' },
    { ...base, id: 'a', entry_date: '2026-03-02' },
  ])?.id, 'a');
  assert.equal(featuredJournalEntry([]), undefined);
});
