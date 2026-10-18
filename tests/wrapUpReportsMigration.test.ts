import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/20261016_wrap_up_reports.sql', import.meta.url), 'utf8');
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';

test('report migration enforces unique periods, private reads and backend-only writes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.user_id', true)::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO authenticated, service_role;
      INSERT INTO auth.users VALUES ('${owner}'), ('${other}');`);
    await db.exec(migration);
    const insert = `INSERT INTO wrap_up_reports(user_id,period_type,period_key,start_date,end_date,start_at,end_at,timezone,timezone_fallback,payload_version,snapshot,is_historical,source_as_of)
      VALUES ('${owner}','monthly','2026-03','2026-03-01','2026-04-01','2026-03-01Z','2026-04-01Z','UTC',false,1,'{"title":"Saved"}',false,now())`;
    await db.exec(`CREATE TABLE books (id uuid PRIMARY KEY, title text);
      INSERT INTO books VALUES ('${owner}', 'Original');`);
    await db.exec('SET ROLE service_role');
    await db.exec(insert);
    await assert.rejects(db.exec(`UPDATE wrap_up_reports SET snapshot = '{}'`), /permission denied/);
    await assert.rejects(db.exec(insert), /unique/);
    await db.exec(`RESET ROLE; UPDATE books SET title = 'Edited'; DELETE FROM books;`);
    assert.deepEqual((await db.query<{ snapshot: unknown }>('SELECT snapshot FROM wrap_up_reports')).rows[0].snapshot, { title: 'Saved' });

    await db.exec(`RESET ROLE; SET test.user_id = '${other}'; SET ROLE authenticated;`);
    assert.equal((await db.query('SELECT * FROM wrap_up_reports')).rows.length, 0);
    await assert.rejects(db.exec(insert), /permission denied/);
    await db.exec(`SET test.user_id = '${owner}';`);
    assert.equal((await db.query('SELECT * FROM wrap_up_reports')).rows.length, 1);
    await assert.rejects(db.exec(`UPDATE wrap_up_reports SET snapshot = '{}'`), /permission denied/);
    await assert.rejects(db.exec('DELETE FROM wrap_up_reports'), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE anon;');
    await assert.rejects(db.query('SELECT * FROM wrap_up_reports'), /permission denied/);
  } finally { await db.close(); }
});
