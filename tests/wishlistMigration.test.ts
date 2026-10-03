import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261010_merge_wishlist_into_books.sql", import.meta.url), "utf8");
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const book = "10000000-0000-0000-0000-000000000001";
const wish = "40000000-0000-0000-0000-000000000001";
const series = "20000000-0000-0000-0000-000000000001";
const genre = "30000000-0000-0000-0000-000000000001";

// A small legacy schema intentionally missing books.metadata_source and purchase fields.
// This executes real PostgreSQL SQL, without connecting to a user's Supabase database.
async function legacyDatabase() {
  const db = new PGlite();
  await db.exec(`
    SET TIME ZONE 'UTC';
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.user_id', true)::uuid $$;
    CREATE TABLE series (id uuid PRIMARY KEY, user_id uuid NOT NULL, is_wishlist_only boolean DEFAULT true);
    CREATE TABLE books (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL,
      status text NOT NULL DEFAULT 'To Read' CHECK (status IN ('To Read','Up Next','Reading','Paused','Finished','DNF')),
      genres text[], cover_url text, total_pages integer, language text, format text, isbn text,
      publication_date date, description text, series_id uuid REFERENCES series(id), volume_number numeric,
      current_page integer, rating integer, is_favorite boolean DEFAULT false,
      date_started date, date_finished date, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE authors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text);
    CREATE UNIQUE INDEX author_names ON authors(user_id, lower(name));
    CREATE TABLE book_authors (book_id uuid REFERENCES books(id), author_id uuid REFERENCES authors(id), position integer,
      PRIMARY KEY(book_id, author_id), UNIQUE(book_id, position));
    CREATE TABLE genres (id uuid PRIMARY KEY, user_id uuid, is_system boolean);
    CREATE TABLE book_genres (book_id uuid REFERENCES books(id), genre_id uuid REFERENCES genres(id), PRIMARY KEY(book_id, genre_id));
    CREATE TABLE book_pause_periods (book_id uuid REFERENCES books(id), user_id uuid, resumed_at timestamptz);
    CREATE TABLE reading_logs (book_id uuid REFERENCES books(id), user_id uuid, current_page integer);
    CREATE TABLE user_settings (user_id uuid, reading jsonb DEFAULT '{"acquired_wishlist_book_deletion":"return_to_pending","auto_finish_books":true}');
    CREATE TABLE wishlist_items (
      id uuid PRIMARY KEY, user_id uuid NOT NULL, book_id uuid REFERENCES books(id), title text,
      authors text[] DEFAULT '{}', genre_ids uuid[] DEFAULT '{}', genres text[] DEFAULT '{}',
      cover_url text, cover_entity_id uuid, total_pages integer, language text, format text, isbn text,
      publication_date date, description text, metadata_source text, metadata_source_url text,
      series_id uuid REFERENCES series(id), volume_number numeric, price numeric, purchase_url text,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    ALTER TABLE books ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_only ON books FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON books, reading_logs TO authenticated;
    INSERT INTO series VALUES ('${series}', '${owner}', true);
    INSERT INTO genres VALUES ('${genre}', null, true);
    INSERT INTO books (id, user_id, title, status, current_page, rating) VALUES ('${book}', '${owner}', 'Acquired', 'Finished', 200, 5);
    INSERT INTO wishlist_items (id, user_id, title, authors, genre_ids, cover_url, series_id, volume_number, price, purchase_url, metadata_source, created_at)
      VALUES ('${wish}', '${owner}', 'Pending', ARRAY[' Writer ', 'writer', 'Second'], ARRAY['${genre}']::uuid[],
      'https://example.com/shared.jpg', '${series}', 2.5, 12.5, 'https://example.com/buy', 'open_library', '2026-01-01');
    INSERT INTO wishlist_items (id, user_id, book_id, title, price, purchase_url, updated_at) VALUES
      ('40000000-0000-0000-0000-000000000002', '${owner}', '${book}', 'Old snapshot', 9, 'https://example.com/old', '2026-01-01'),
      ('40000000-0000-0000-0000-000000000003', '${owner}', '${book}', 'New snapshot', 15, 'https://example.com/new', '2026-02-01');
    INSERT INTO user_settings VALUES ('${owner}', '{"acquired_wishlist_book_deletion":"return_to_pending","auto_finish_books":true}');
  `);
  return db;
}

test("migration preserves records, relationships and purchase data; scopes remain user-isolated", async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(migration);
    const pending = (await db.query<any>(`SELECT * FROM books WHERE id = '${wish}'`)).rows[0];
    assert.equal(pending.status, "Wishlist");
    assert.equal(pending.cover_url, "https://example.com/shared.jpg");
    assert.equal(pending.metadata_source, "open_library");
    assert.equal(Number(pending.price), 12.5);
    assert.equal(Number(pending.volume_number), 2.5);
    assert.equal(new Date(pending.created_at).toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal((await db.query("SELECT * FROM book_authors")).rows.length, 2);
    assert.equal((await db.query("SELECT * FROM book_genres")).rows.length, 1);
    const acquired = (await db.query<any>(`SELECT * FROM books WHERE id = '${book}'`)).rows[0];
    assert.equal(acquired.status, "Finished");
    assert.equal(acquired.current_page, 200);
    assert.equal(acquired.rating, 5);
    assert.equal(Number(acquired.price), 15);
    assert.equal(acquired.purchase_url, "https://example.com/new");
    assert.equal((await db.query<any>("SELECT to_regclass('public.wishlist_items') AS legacy")).rows[0].legacy, null);
    assert.deepEqual((await db.query<any>("SELECT reading FROM user_settings")).rows[0].reading, { auto_finish_books: true });
    await db.exec(`INSERT INTO user_settings (user_id) VALUES ('${other}')`);
    assert.deepEqual((await db.query<any>(`SELECT reading FROM user_settings WHERE user_id = '${other}'`)).rows[0].reading, { auto_finish_books: true });

    await db.exec(`SET test.user_id = '${other}'; SET ROLE authenticated;`);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 0);
    assert.equal((await db.query(`UPDATE books SET status = 'To Read' WHERE id = '${wish}' RETURNING id`)).rows.length, 0);
    await assert.rejects(db.exec(`INSERT INTO books (user_id, title) VALUES ('${owner}', 'Forbidden')`), /row-level security/);
    await db.exec(`SET test.user_id = '${owner}';`);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 2);
    await assert.rejects(db.exec(`INSERT INTO reading_logs VALUES ('${wish}', '${owner}', 10)`), /before logging reading/);
    await db.exec(`UPDATE books SET status = 'To Read' WHERE id = '${wish}' AND status = 'Wishlist'; RESET ROLE;`);
    assert.equal((await db.query<any>(`SELECT is_wishlist_only FROM series WHERE id = '${series}'`)).rows[0].is_wishlist_only, false);
    await db.exec(`UPDATE books SET status = 'Reading' WHERE id = '${wish}'; UPDATE books SET status = 'To Read' WHERE id = '${wish}' AND status = 'Wishlist';`);
    assert.equal((await db.query<any>(`SELECT status FROM books WHERE id = '${wish}'`)).rows[0].status, "Reading");

    await db.exec(`INSERT INTO reading_logs VALUES ('${book}', '${owner}', 200);
      UPDATE books SET status = 'Paused' WHERE id = '${book}';
      INSERT INTO book_pause_periods VALUES ('${book}', '${owner}', null);
      UPDATE books SET status = 'Wishlist' WHERE id = '${book}';`);
    assert.ok((await db.query<any>("SELECT resumed_at FROM book_pause_periods")).rows[0].resumed_at);
    assert.equal((await db.query("SELECT * FROM reading_logs")).rows.length, 1);
    assert.equal((await db.query<any>(`SELECT current_page FROM books WHERE id = '${book}'`)).rows[0].current_page, 200);
    // Reapplying after removal of the old table remains safe.
    await db.exec(migration);
    await db.exec(`INSERT INTO series VALUES ('20000000-0000-0000-0000-000000000002', '${owner}', true);
      INSERT INTO books (id, user_id, title, status, series_id) VALUES ('10000000-0000-0000-0000-000000000002', '${owner}', 'Temporary wish', 'Wishlist', '20000000-0000-0000-0000-000000000002');
      DELETE FROM books WHERE id = '10000000-0000-0000-0000-000000000002';`);
    assert.equal((await db.query("SELECT * FROM series WHERE id = '20000000-0000-0000-0000-000000000002'")).rows.length, 0);
  } finally { await db.close(); }
});

test("migration aborts and rolls back on cross-user legacy links", async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(`UPDATE wishlist_items SET user_id = '${other}' WHERE book_id IS NOT NULL;`);
    await assert.rejects(db.exec(migration), /Invalid acquired wishlist link/);
    await db.exec("ROLLBACK");
    assert.equal((await db.query("SELECT * FROM wishlist_items")).rows.length, 3);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 1);
    assert.equal((await db.query("SELECT * FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'metadata_source'")).rows.length, 0);
  } finally { await db.close(); }
});

test("migration aborts instead of overwriting a colliding book ID", async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(`INSERT INTO books (id, user_id, title) VALUES ('${wish}', '${owner}', 'Existing');`);
    await assert.rejects(db.exec(migration), /ID collision/);
    await db.exec("ROLLBACK");
    assert.equal((await db.query("SELECT * FROM wishlist_items")).rows.length, 3);
  } finally { await db.close(); }
});

test("fresh-install schema supports wishlist without a legacy table", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.user_id', true)::uuid $$;
      CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
      CREATE TABLE storage.objects (id uuid PRIMARY KEY, bucket_id text, name text);`);
    await db.exec(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO auth.users VALUES ('${owner}');
      INSERT INTO books (id, user_id, title, status, price, purchase_url) VALUES ('${wish}', '${owner}', 'Fresh wish', 'Wishlist', 12, 'https://example.com');`);
    assert.equal((await db.query<any>("SELECT to_regclass('public.wishlist_items') AS legacy")).rows[0].legacy, null);
    assert.equal((await db.query<any>("SELECT status FROM books")).rows[0].status, "Wishlist");
    // Exercise deletion with the real wishlist-placeholder cleanup trigger installed.
    await db.exec(`SET test.user_id = '${owner}';
      INSERT INTO series (id, user_id, name, is_wishlist_only) VALUES ('${series}', '${owner}', 'Wish series', true);
      UPDATE books SET series_id = '${series}' WHERE id = '${wish}';
      SELECT delete_series('${series}', false);`);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 1);
    assert.equal((await db.query<any>("SELECT series_id FROM books")).rows[0].series_id, null);
    await db.exec(`INSERT INTO series (id, user_id, name, is_wishlist_only) VALUES ('${series}', '${owner}', 'Wish series', true);
      UPDATE books SET series_id = '${series}' WHERE id = '${wish}';
      SELECT delete_series('${series}', true);`);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM series")).rows.length, 0);
  } finally { await db.close(); }
});

test("acquired book purchase values take precedence over legacy snapshots", async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(`ALTER TABLE books ADD COLUMN price numeric; ALTER TABLE books ADD COLUMN purchase_url text;
      UPDATE books SET price = 20, purchase_url = 'https://example.com/current' WHERE id = '${book}';`);
    await db.exec(migration);
    const result = (await db.query<any>(`SELECT price, purchase_url FROM books WHERE id = '${book}'`)).rows[0];
    assert.equal(Number(result.price), 20);
    assert.equal(result.purchase_url, "https://example.com/current");
  } finally { await db.close(); }
});

test("migration rejects a pending wish linked to another user's private genre", async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(`UPDATE genres SET is_system = false, user_id = '${other}' WHERE id = '${genre}';`);
    await assert.rejects(db.exec(migration), /Invalid wishlist genre ownership/);
    await db.exec("ROLLBACK");
    assert.equal((await db.query("SELECT * FROM wishlist_items")).rows.length, 3);
    assert.equal((await db.query("SELECT * FROM books")).rows.length, 1);
  } finally { await db.close(); }
});
