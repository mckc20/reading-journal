import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261127_custom_collections.sql", import.meta.url), "utf8");
const orderMigration = readFileSync(new URL("../supabase/migrations/20261128_custom_collections_order.sql", import.meta.url), "utf8");
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const book = "10000000-0000-0000-0000-000000000001";
const wish = "10000000-0000-0000-0000-000000000002";
const otherBook = "10000000-0000-0000-0000-000000000003";

test("custom collections validate names, preserve books and enforce ownership", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.user_id', true)::uuid $$;
      CREATE TABLE books (id uuid PRIMARY KEY, user_id uuid NOT NULL, status text, current_page int);
      ALTER TABLE books ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner_only ON books USING (user_id = auth.uid());
      GRANT SELECT, UPDATE, DELETE ON books TO authenticated;
      INSERT INTO auth.users VALUES ('${owner}'), ('${other}');
      INSERT INTO books VALUES ('${book}', '${owner}', 'Reading', 50), ('${wish}', '${owner}', 'Wishlist', 0),
        ('${otherBook}', '${other}', 'To Read', 0);
    `);
    await db.exec(migration);
    await db.exec(`SET ROLE authenticated; SET test.user_id = '${owner}';`);
    const create = async (name: string) => (await db.query<{ id: string }>(
      "INSERT INTO collections (name) VALUES ($1) RETURNING id", [name],
    )).rows[0].id;
    const club = await create("Book Club");
    const gifts = await create("Gift Ideas");
    await assert.rejects(create("book club"), /unique constraint/);
    for (const name of ["", " \t", " Book Club ", "x".repeat(81)]) {
      await assert.rejects(create(name), /check constraint/);
    }
    await assert.rejects(db.query("UPDATE collections SET description = $1", ["x".repeat(501)]), /check constraint/);
    await assert.rejects(db.query("UPDATE collections SET user_id = $1", [other]), /permission denied/);
    await db.query("UPDATE collections SET name = 'Reading Group' WHERE id = $1", [club]);

    const link = (collection: string, bookId: string, retry = false) => db.query(
      `INSERT INTO collection_books VALUES ($1, $2) ${retry ? "ON CONFLICT (collection_id, book_id) DO NOTHING" : ""}`,
      [collection, bookId],
    );
    await link(club, book);
    await link(club, wish);
    await link(gifts, wish);
    await assert.rejects(link(club, book), /unique constraint/);
    await link(club, book, true);
    await assert.rejects(link(club, otherBook, true), /row-level security/);
    await db.query("UPDATE books SET status = 'To Read' WHERE id = $1", [wish]);
    assert.equal((await db.query("SELECT * FROM collection_books WHERE book_id = $1", [wish])).rows.length, 2);

    await db.exec("RESET ROLE;");
    await db.exec(orderMigration);
    await db.exec("SET ROLE authenticated;");
    const saveBooks = (id: string, ordered: string[], added: string[] = [], removed: string[] = []) => db.query(
      "SELECT save_collection_books($1, $2::uuid[], $3::uuid[], $4::uuid[])", [id, ordered, added, removed],
    );
    const positions = async (id: string) => (await db.query(
      "SELECT book_id, position FROM collection_books WHERE collection_id = $1 ORDER BY position, book_id", [id],
    )).rows;
    assert.deepEqual(await positions(club), [{ book_id: book, position: null }, { book_id: wish, position: null }]);
    await saveBooks(club, [wish, book]);
    assert.deepEqual(await positions(club), [{ book_id: wish, position: 1 }, { book_id: book, position: 2 }]);
    assert.deepEqual(await positions(gifts), [{ book_id: wish, position: null }]);
    await assert.rejects(saveBooks(club, [otherBook, book], [otherBook], [wish]), /row-level security/);
    assert.deepEqual(await positions(club), [{ book_id: wish, position: 1 }, { book_id: book, position: 2 }]);
    await saveBooks(club, [book], [], [wish]);
    await link(club, wish);
    assert.deepEqual(await positions(club), [{ book_id: book, position: 1 }, { book_id: wish, position: null }]);
    await saveBooks(gifts, [book, wish], [book]);
    await saveBooks(gifts, [book, wish], [book]);
    assert.deepEqual(await positions(gifts), [{ book_id: book, position: 1 }, { book_id: wish, position: 2 }]);
    await saveBooks(gifts, [wish], [], [book]);

    await db.exec(`SET test.user_id = '${other}';`);
    const otherCollection = await create("Reading Group");
    await link(otherCollection, otherBook);
    assert.deepEqual((await db.query("SELECT id FROM collections")).rows, [{ id: otherCollection }]);
    assert.equal((await db.query("SELECT * FROM collection_books")).rows.length, 1);
    assert.equal((await db.query("UPDATE collections SET name = 'Stolen' WHERE id = $1 RETURNING id", [club])).rows.length, 0);
    assert.equal((await db.query("DELETE FROM collections WHERE id = $1 RETURNING id", [club])).rows.length, 0);
    assert.equal((await db.query("DELETE FROM collection_books WHERE collection_id = $1 RETURNING book_id", [club])).rows.length, 0);
    await assert.rejects(link(club, otherBook, true), /row-level security/);
    await assert.rejects(saveBooks(club, [otherBook], [otherBook]), /Collection unavailable/);
    await assert.rejects(link(otherCollection, book, true), /row-level security/);
    await assert.rejects(db.query("INSERT INTO collections (user_id, name) VALUES ($1, 'Forged')", [owner]), /row-level security/);

    await db.exec(`SET test.user_id = '${owner}';`);
    await assert.rejects(link(otherCollection, book, true), /row-level security/);
    assert.equal((await db.query("SELECT id FROM collections WHERE id = $1", [otherCollection])).rows.length, 0);
    assert.equal((await db.query("UPDATE collections SET description = 'Stolen' WHERE id = $1 RETURNING id", [otherCollection])).rows.length, 0);
    assert.equal((await db.query("DELETE FROM collections WHERE id = $1 RETURNING id", [otherCollection])).rows.length, 0);
    await db.query("DELETE FROM collections WHERE id = $1", [club]);
    assert.deepEqual((await db.query("SELECT collection_id, book_id FROM collection_books")).rows, [{ collection_id: gifts, book_id: wish }]);
    assert.deepEqual((await db.query("SELECT current_page FROM books WHERE id = $1", [book])).rows, [{ current_page: 50 }]);
    await db.query("DELETE FROM books WHERE id = $1", [wish]);
    assert.equal((await db.query("SELECT * FROM collection_books")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM collections")).rows.length, 1);
    await db.exec("RESET ROLE; SET ROLE anon;");
    await assert.rejects(db.query("SELECT * FROM collections"), /permission denied/);
    await assert.rejects(saveBooks(gifts, []), /permission denied/);
  } finally {
    await db.close();
  }
});
