import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appHandler } from '../api/_lib/appHttp.js';

function responseFixture() {
  const result = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const response = {
    status(status: number) { result.status = status; return response; },
    json(body: unknown) { result.body = body; },
    setHeader(key: string, value: string) { result.headers[key] = value; },
  } as unknown as VercelResponse;
  return { response, result };
}

test('shared API entry routes requests without changing auth headers, methods, query or body', async () => {
  for (const [query, expected] of [
    [{ route: 'me' }, 'me'],
    [{ route: 'wrap-ups' }, 'archive'],
    [{ route: 'wrap-ups', monthKey: '2026-03' }, 'report'],
    [{ route: 'wrap-ups', monthKey: ['2026-03', '2026-04'] }, 'report'],
  ] as const) {
    const request = { query, method: 'POST', headers: { authorization: 'Bearer fixture' }, body: { user_id: 'untrusted' } } as unknown as VercelRequest;
    const called: string[] = [];
    const handler = (name: string) => async (received: VercelRequest) => { assert.equal(received, request); called.push(name); };
    await appHandler({ me: handler('me'), archive: handler('archive'), report: handler('report') })(request, responseFixture().response);
    assert.deepEqual(called, [expected]);
  }
});

test('unknown or ambiguous shared routes cannot fall through to a handler', async () => {
  const fail = async () => { assert.fail('No handler should run'); };
  for (const route of [undefined, 'unknown', ['me', 'wrap-ups']]) {
    const { response, result } = responseFixture();
    await appHandler({ me: fail, archive: fail, report: fail })({ query: { route } } as unknown as VercelRequest, response);
    assert.equal(result.status, 404);
  }
});

test('rewritten routes retain unauthenticated access and method protections', async () => {
  for (const query of [{ route: 'me' }, { route: 'wrap-ups' }, { route: 'wrap-ups', monthKey: '2026-03' }]) {
    const { response, result } = responseFixture();
    await appHandler()({ query, method: 'GET', headers: {} } as VercelRequest, response);
    assert.equal(result.status, 401);
    if (query.route === 'wrap-ups') assert.equal(result.headers['Cache-Control'], 'private, no-store');
  }
  const { response, result } = responseFixture();
  await appHandler()({ query: { route: 'me' }, method: 'POST', headers: {} } as unknown as VercelRequest, response);
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'GET');
});

test('deployment preserves public API paths and fits the 12-function Hobby limit', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const [source, destination] of [
    ['/api/me', '/api/app?route=me'],
    ['/api/wrap-ups', '/api/app?route=wrap-ups'],
    ['/api/wrap-ups/:monthKey', '/api/app?route=wrap-ups&monthKey=:monthKey'],
  ]) assert(config.rewrites.some((rewrite: { source: string; destination: string }) => rewrite.source === source && rewrite.destination === destination));
  const functions = readdirSync(new URL('../api/', import.meta.url), { recursive: true })
    .map(String).filter(name => !name.startsWith('_lib/') && name.endsWith('.ts'));
  assert.equal(functions.length, 12);
});
