import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWrapUpArchive, monthLabel, type HistoryBook } from '../src/lib/wrapUpArchive.js';
import { loadWrapUpArchive } from '../api/_lib/wrapUpArchive.js';

const now = new Date('2026-04-01T00:30:00Z');
const book = (changes: Partial<HistoryBook> = {}): HistoryBook => ({ date_started: null, date_finished: null, created_at: '2026-03-01T12:00:00Z', ...changes });

test('archive includes gaps from the earliest dated history and never earlier months', () => {
  const archive = buildWrapUpArchive([book({ date_finished: '2025-12-10' })], [], [], 'UTC', now);
  assert.deepEqual(archive.months.map(month => month.key), ['2026-03', '2026-02', '2026-01', '2025-12']);
  assert(archive.months.every(month => !month.saved));
  assert.equal(monthLabel('2025-12'), 'December 2025');
});

test('book-added dates and reading logs independently establish history', () => {
  assert.deepEqual(buildWrapUpArchive([book()], [], [], 'UTC', now).months.map(month => month.key), ['2026-03']);
  const archive = buildWrapUpArchive([], [{ logged_at: '2026-02-01T00:00:00Z' }], [], 'UTC', now);
  assert.deepEqual(archive.months.map(month => month.key), ['2026-03', '2026-02']);
});

test('timezone controls completion and timestamp months, calendar dates remain unchanged', () => {
  const archive = buildWrapUpArchive([book({ created_at: '2026-03-01T00:30:00Z' })], [], [], 'America/New_York', now);
  assert.deepEqual(archive.months.map(month => month.key), ['2026-02']);
  const calendar = buildWrapUpArchive([book({ date_started: '2026-01-01' })], [], [], 'America/New_York', now);
  assert.equal(calendar.months.at(-1)?.key, '2026-01');
});

test('saved reports survive deletion without inventing earlier source history', () => {
  const saved = [{ period_key: '2025-10', booksFinished: 2 }, { period_key: '2026-02', booksFinished: 0 }];
  const archive = buildWrapUpArchive([], [], saved, 'UTC', now);
  assert.deepEqual(archive.months, [
    { key: '2026-02', saved: true, booksFinished: 0 }, { key: '2025-10', saved: true, booksFinished: 2 },
  ]);
});

test('missing, invalid, current-only and future-only sources give an empty archive', () => {
  for (const books of [[], [book({ created_at: null, date_finished: '2026-02-30', date_started: 'invalid' })], [book({ created_at: '2026-04-01' })], [book({ created_at: '2027-01-01' })]]) {
    const archive = buildWrapUpArchive(books, [{ logged_at: 'invalid' }], [], 'invalid-zone', now);
    assert.deepEqual(archive.months, []);
    assert.equal(archive.timezoneFallback, true);
    assert.equal(archive.timezone, 'UTC');
  }
});

test('archive repository scopes and paginates sources and loads summaries without full snapshots', async () => {
  const calls: { table: string; fields?: string; filters: [string, string][]; offset?: number }[] = [];
  const admin = { from(table: string) {
    const call = { table, filters: [] } as typeof calls[number]; calls.push(call);
    const query = {
      select(fields: string) { call.fields = fields; return query; },
      eq(key: string, value: string) { call.filters.push([key, value]); return query; }, order() { return query; },
      async range(offset: number) {
        call.offset = offset;
        return { error: null, data: table === 'books' && offset === 0 ? Array.from({ length: 500 }, () => book()) : [] };
      },
      async maybeSingle() { return { data: { timezone: 'UTC' }, error: null }; },
    }; return query;
  } };
  const archive = await loadWrapUpArchive(admin as never, 'owner', now);
  assert.equal(archive.months.length, 1);
  for (const call of calls.filter(call => call.table !== 'profiles')) assert(call.filters.some(([key, value]) => key === 'user_id' && value === 'owner'));
  assert(calls.some(call => call.table === 'books' && call.offset === 500));
  const summary = calls.find(call => call.table === 'wrap_up_reports')!;
  assert(summary.filters.some(([key, value]) => key === 'period_type' && value === 'monthly'));
  assert.equal(summary.fields, 'id,period_key,booksFinished:snapshot->totals->booksFinished');
  assert.deepEqual(calls.find(call => call.table === 'profiles')?.filters, [['id', 'owner']]);
});

test('a timezone change at month rollover does not hide a previously saved report', () => {
  const archive = buildWrapUpArchive([], [], [{ period_key: '2026-03', booksFinished: 1 }], 'America/New_York', now);
  assert.deepEqual(archive.months, [{ key: '2026-03', saved: true, booksFinished: 1 }]);
});

test('dated journal entries can establish older history without reading logs', () => {
  const archive = buildWrapUpArchive([book()], [], [], 'UTC', now, [
    { entry_date: '2026-01-15' }, { entry_date: 'invalid' },
  ]);
  assert.deepEqual(archive.months.map(month => month.key), ['2026-03', '2026-02', '2026-01']);
});
