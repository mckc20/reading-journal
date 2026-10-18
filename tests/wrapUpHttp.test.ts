import assert from 'node:assert/strict';
import test from 'node:test';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { wrapUpHandler } from '../api/_lib/wrapUpHttp.js';
import { generateMonthlyReport, type ReportRepository } from '../api/_lib/wrapUpReports.js';
import type { SavedMonthlyReport } from '../src/lib/wrapUpArchive.js';

function fixture() {
  const saved = new Map<string, SavedMonthlyReport>();
  let generationCalls = 0;
  let failSources = false;
  let history = true;
  const accessedUsers: string[] = [];
  const repository: ReportRepository = {
    async find(user, key) { accessedUsers.push(user); return saved.get(`${user}:${key}`) ?? null; },
    async timezone() { return 'UTC'; },
    async sources() { if (failSources) throw new Error('Source failure'); return { books: [], logs: [] }; },
    async insert(row) {
      const key = `${row.user_id}:${row.period_key}`;
      if (saved.has(key)) throw { code: '23505' };
      const report = { ...row, id: 'report', created_at: '2026-04-01T00:00:00Z' } as unknown as SavedMonthlyReport;
      saved.set(key, report); return report;
    },
  };
  const dependencies = {
    async authenticate(request: VercelRequest) { return request.headers.authorization === 'Bearer valid' ? 'owner' : null; },
    async archive(user: string) { accessedUsers.push(user); return { months: history ? [{ key: '2026-03', saved: false }] : [], timezone: 'UTC', timezoneFallback: false }; },
    find: repository.find,
    async generate(user: string, key: string) { generationCalls++; return generateMonthlyReport(user, key, { repository, now: new Date('2026-04-01T12:00:00Z') }); },
  };
  async function call(method = 'GET', key: unknown = '2026-03', token = 'valid', detail = true) {
    const result = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
    const request = { method, query: { monthKey: key, user_id: 'victim' }, body: { user_id: 'victim' }, headers: { authorization: `Bearer ${token}` } } as VercelRequest;
    const response = {
      setHeader(key: string, value: string) { result.headers[key] = value; },
      status(status: number) { result.status = status; return response; }, json(body: unknown) { result.body = body; },
    } as unknown as VercelResponse;
    await wrapUpHandler(detail, dependencies)(request, response);
    return result;
  }
  return { call, saved, accessedUsers, generationCalls: () => generationCalls, failSources() { failSources = true; }, deleteHistory() { history = false; } };
}

test('private endpoints require a session and reject unsupported methods', async () => {
  const f = fixture();
  assert.equal((await f.call('GET', '2026-03', 'invalid')).status, 401);
  assert.equal((await f.call('POST', '2026-03', 'invalid')).status, 401);
  const wrongMethod = await f.call('DELETE');
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.Allow, 'GET, POST');
  assert.equal((await f.call('POST', '2026-03', 'valid', false)).status, 405);
  assert.equal(f.generationCalls(), 0);
  assert.deepEqual(f.accessedUsers, []);
});

test('listing and unsaved GET never generate; invalid and unsupported months are rejected', async () => {
  const f = fixture();
  assert.equal((await f.call('GET', undefined, 'valid', false)).status, 200);
  assert.equal((await f.call()).status, 404);
  for (const key of ['invalid', '2026-13', ['2026-03']]) assert.equal((await f.call('POST', key)).status, 400);
  for (const key of ['2026-04', '2027-01', '2020-01']) assert.equal((await f.call('POST', key)).status, 404);
  assert.equal(f.generationCalls(), 0);
});

test('concurrent opens and revisits return one immutable snapshot; caller ownership is ignored', async () => {
  const f = fixture();
  const responses = await Promise.all([f.call('POST'), f.call('POST')]);
  assert(responses.every(response => response.status === 200));
  assert.equal(f.saved.size, 1);
  assert.deepEqual(responses[0].body, responses[1].body);
  f.deleteHistory();
  assert.deepEqual((await f.call()).body, responses[0].body);
  assert.deepEqual((await f.call('POST')).body, responses[0].body);
  assert(f.accessedUsers.every(user => user === 'owner'));
  assert.equal((responses[0].body as SavedMonthlyReport).user_id, 'owner');
  assert.equal(responses[0].headers['Cache-Control'], 'private, no-store');
});

test('another owner’s saved report cannot be retrieved through the detail endpoint', async () => {
  const f = fixture();
  await f.call('POST');
  const report = f.saved.get('owner:2026-03')!;
  f.saved.clear();
  f.saved.set('victim:2026-03', { ...report, user_id: 'victim' });
  assert.equal((await f.call()).status, 404);
});

test('failed generation returns a retryable failure and saves nothing', async () => {
  const f = fixture(); f.failSources();
  const response = await f.call('POST');
  assert.equal(response.status, 500);
  assert.equal(f.saved.size, 0);
  assert.deepEqual(response.body, { error: 'Could not load your wrap-up. Please try again.' });
});
