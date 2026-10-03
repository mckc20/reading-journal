import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261011_optional_series_book_deletion.sql", import.meta.url), "utf8");
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const series = "10000000-0000-0000-0000-000000000001";
const otherSeries = "10000000-0000-0000-0000-000000000002";

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.user_id', true)::uuid $$;
    CREATE TABLE series (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE books (id uuid PRIMARY KEY, user_id uuid, status text, series_id uuid REFERENCES series(id) ON DELETE SET NULL);
    CREATE TABLE reading_logs (book_id uuid REFERENCES books(id) ON DELETE CASCADE, user_id uuid);
    CREATE TABLE book_journal (book_id uuid REFERENCES books(id) ON DELETE CASCADE, user_id uuid);
    ALTER TABLE series ENABLE ROW LEVEL SECURITY;
    ALTER TABLE books ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_series ON series FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY owner_books ON books FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT, UPDATE, DELETE ON series, books TO authenticated;
    INSERT INTO series VALUES ('${series}', '${owner}'), ('${otherSeries}', '${other}');
    INSERT INTO books VALUES
      ('20000000-0000-0000-0000-000000000001', '${owner}', 'Reading', '${series}'),
      ('20000000-0000-0000-0000-000000000002', '${owner}', 'Wishlist', '${series}'),
      ('20000000-0000-0000-0000-000000000003', '${owner}', 'Finished', null),
      ('20000000-0000-0000-0000-000000000004', '${other}', 'Reading', '${otherSeries}');
    INSERT INTO reading_logs SELECT id, user_id FROM books;
    INSERT INTO book_journal SELECT id, user_id FROM books;
  `);
  await db.exec(migration);
  await db.exec(`SET test.user_id = '${owner}'; SET ROLE authenticated;`);
  return db;
}

test("series deletion keeps and detaches all books by default", async () => {
  const db = await database();
  try {
    await db.exec(`SELECT delete_series('${series}'); RESET ROLE;`);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 4);
    assert.equal((await db.query(`SELECT * FROM books WHERE series_id = '${series}'`)).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM reading_logs")).rows.length, 4);
    assert.equal((await db.query("SELECT * FROM book_journal")).rows.length, 4);
    assert.equal((await db.query("SELECT * FROM series")).rows.length, 1);
  } finally { await db.close(); }
});

test("checked option deletes linked library/wishlist books and their data only", async () => {
  const db = await database();
  try {
    await db.exec(`SELECT delete_series('${series}', true); RESET ROLE;`);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 2);
    assert.equal((await db.query("SELECT * FROM reading_logs")).rows.length, 2);
    assert.equal((await db.query("SELECT * FROM book_journal")).rows.length, 2);
    assert.equal((await db.query(`SELECT * FROM series WHERE id = '${otherSeries}'`)).rows.length, 1);
    assert.equal((await db.query(`SELECT * FROM books WHERE user_id = '${other}'`)).rows.length, 1);
  } finally { await db.close(); }
});

test("series deletion cannot target another user's series", async () => {
  const db = await database();
  try {
    await assert.rejects(db.exec(`SELECT delete_series('${otherSeries}', true)`), /Series not found/);
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 4);
    assert.equal((await db.query("SELECT * FROM series")).rows.length, 2);
  } finally { await db.close(); }
});

test("book deletion rolls back if the series deletion fails", async () => {
  const db = await database();
  try {
    await db.exec(`RESET ROLE;
      CREATE FUNCTION fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Deletion blocked'; END; $$;
      CREATE TRIGGER fail_delete BEFORE DELETE ON series FOR EACH ROW EXECUTE FUNCTION fail_delete();
      SET ROLE authenticated;`);
    await assert.rejects(db.exec(`SELECT delete_series('${series}', true)`), /Deletion blocked/);
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 4);
    assert.equal((await db.query("SELECT * FROM book_journal")).rows.length, 4);
    assert.equal((await db.query("SELECT * FROM reading_logs")).rows.length, 4);
  } finally { await db.close(); }
});

test("empty series can be deleted with either checkbox choice", async () => {
  const db = await database();
  try {
    await db.exec(`RESET ROLE;
      INSERT INTO series VALUES ('10000000-0000-0000-0000-000000000003', '${owner}'), ('10000000-0000-0000-0000-000000000004', '${owner}');
      SET ROLE authenticated;
      SELECT delete_series('10000000-0000-0000-0000-000000000003', false);
      SELECT delete_series('10000000-0000-0000-0000-000000000004', true);
      RESET ROLE;`);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 4);
    assert.equal((await db.query("SELECT * FROM series")).rows.length, 2);
  } finally { await db.close(); }
});
