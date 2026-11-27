import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { buildPagesTimeline } from "../src/lib/bookAnalytics";
import { buildAnalyticsDashboardData } from "../src/lib/analyticsDashboard";
import { getLocalReadingDay, getLoggedSessionMinutes, getSessionTimes } from "../src/lib/readingActivity";
import { calculateReadingHabits } from "../src/lib/readingHabits";
import { readingPageDeltas } from "../src/lib/readingPageDeltas";
import { buildMonthlyReport, monthlyPeriod, type ReportBook, type ReportLog } from "../src/lib/wrapUpReports";
import type { Book, ReadingLog } from "../src/types";

const migration = readFileSync(new URL("../supabase/migrations/20261129_reading_activity.sql", import.meta.url), "utf8");
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const progressBook = "10000000-0000-0000-0000-000000000001";
const mixedBook = "10000000-0000-0000-0000-000000000002";
const otherBook = "10000000-0000-0000-0000-000000000003";
const missingTotal = "10000000-0000-0000-0000-000000000004";
const legacyBook = "10000000-0000-0000-0000-000000000005";
const dstBook = "10000000-0000-0000-0000-000000000006";

function utcTodayAsLateEvening() {
  // Choose a real time zone where the clock says 22:xx, independent of test run time.
  const now = new Date();
  const offset = ((22 - now.getUTCHours() + 11 + 24) % 24) - 11;
  const zone = offset === 0 ? "UTC" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;
  const local = new Date(now.getTime() + offset * 3_600_000);
  function at(hour: number, minutes = 0, dayOffset = 0) {
    const instant = new Date(local);
    instant.setUTCHours(hour, minutes, 0, 0);
    return new Date(instant.getTime() - offset * 3_600_000 + dayOffset * 86_400_000).toISOString();
  }
  return { zone, at };
}

test("migration saves daily progress and sessions atomically with owner isolation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.user_id', true), '')::uuid
      $$;
      CREATE TABLE books (
        id uuid PRIMARY KEY, user_id uuid NOT NULL, status text NOT NULL, current_page integer,
        total_pages integer, date_started date, date_finished date
      );
      CREATE TABLE reading_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, book_id uuid NOT NULL REFERENCES books(id),
        current_page integer NOT NULL CHECK (current_page >= 0), reading_time_minutes integer CHECK (reading_time_minutes >= 0),
        logged_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE book_pause_periods (book_id uuid, user_id uuid, resumed_at timestamptz);
      ALTER TABLE books ENABLE ROW LEVEL SECURITY;
      ALTER TABLE reading_logs ENABLE ROW LEVEL SECURITY;
      CREATE POLICY books_owner ON books USING (user_id = auth.uid());
      CREATE POLICY logs_owner_select ON reading_logs FOR SELECT USING (user_id = auth.uid());
      CREATE POLICY "reading_logs: owner insert" ON reading_logs FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "reading_logs: owner update" ON reading_logs FOR UPDATE USING (user_id = auth.uid());
      GRANT SELECT, INSERT, UPDATE ON books, reading_logs, book_pause_periods TO authenticated, service_role;
      INSERT INTO books VALUES
        ('${progressBook}', '${owner}', 'Reading', 100, 160, NULL, NULL),
        ('${mixedBook}', '${owner}', 'Reading', 125, 180, NULL, NULL),
        ('${otherBook}', '${other}', 'Reading', 4, 150, NULL, NULL),
        ('${missingTotal}', '${owner}', 'Reading', 0, NULL, NULL, NULL),
        ('${legacyBook}', '${owner}', 'To Read', 20, 240, NULL, NULL),
        ('${dstBook}', '${owner}', 'Reading', 20, 240, NULL, NULL);
      INSERT INTO reading_logs (user_id, book_id, current_page, reading_time_minutes)
        VALUES ('${owner}', '${legacyBook}', 20, 5);
    `);
    await db.exec(migration);
    await db.exec(`SET ROLE authenticated; SET test.user_id = '${owner}';`);

    const { zone, at } = utcTodayAsLateEvening();
    function save(
      bookId: string, kind: "progress_update" | "session", from: number, to: number, end: string,
      minutes: number | null = null, start: string | null = null, id = crypto.randomUUID(), timeZone = zone,
    ) {
      return db.query<{ entry: ReadingLog }>(
        "SELECT to_jsonb(save_reading_activity($1, $2, $3, $4, $5, $6, $7, $8, $9)) AS entry",
        [bookId, id, kind, from, to, minutes, end, start, timeZone],
      ).then(result => result.rows[0].entry);
    }
    async function logs(bookId: string) {
      return (await db.query<{ entry: ReadingLog }>(
        "SELECT to_jsonb(reading_logs) AS entry FROM reading_logs WHERE book_id = $1 ORDER BY logged_at", [bookId],
      )).rows.map(row => row.entry);
    }

    const prevDay = -1;
    const noon = await save(progressBook, "progress_update", 100, 125, at(12, 0, prevDay), 30);
    const evening = await save(progressBook, "progress_update", 125, 145, at(20, 0, prevDay), 20);
    assert.equal(Date.parse(noon.window_started_at!), Date.parse(at(0, 0, prevDay)));
    assert.equal(Date.parse(evening.window_started_at!), Date.parse(at(12, 0, prevDay)));
    const progress = await logs(progressBook);
    const progressHabits = calculateReadingHabits(progress, at(0, 0, prevDay), at(23));
    assert.equal(buildPagesTimeline(progress).reduce((sum, day) => sum + day.pages, 0), 45);
    assert.equal(progressHabits.weekdays.all.reduce((sum, day) => sum + day.totalMinutes, 0), 50);
    assert.equal(progressHabits.totalLogs, 0);
    assert.equal(progressHabits.usualTime.dayParts.reduce((sum, part) => sum + part.minutes, 0), 0);

    const insertedLater = await save(progressBook, "progress_update", 145, 150, at(15, 0, prevDay), 10);
    const updated = await logs(progressBook);
    assert.equal(Date.parse(insertedLater.window_started_at!), Date.parse(at(12, 0, prevDay)));
    assert.equal(Date.parse(updated[2].window_started_at!), Date.parse(at(15, 0, prevDay)));
    assert.deepEqual(readingPageDeltas(updated).map(row => row.pages), [25, 5, 20]);
    const nextDay = await save(progressBook, "progress_update", 150, 160, at(8));
    assert.equal(Date.parse(nextDay.window_started_at!), Date.parse(at(0)));
    assert.equal(nextDay.reading_time_minutes, null);
    assert.deepEqual((await db.query(
      "SELECT current_page, status, date_finished::text FROM books WHERE id = $1", [progressBook],
    )).rows, [{ current_page: 160, status: "Finished", date_finished: nextDay.local_day }]);
    assert.equal((await save(progressBook, "progress_update", 150, 160, at(8), null, null, nextDay.id)).id, nextDay.id);
    assert.equal((await logs(progressBook)).length, 4);

    const timestampAtViennaNoon = "2026-03-29T10:00:00Z";
    const dst = await save(dstBook, "progress_update", 20, 30, timestampAtViennaNoon, 20, null, crypto.randomUUID(), "Europe/Vienna");
    assert.equal(Date.parse(dst.window_started_at!), Date.parse("2026-03-28T23:00:00Z"));
    const repeatedMidnight = await save(dstBook, "progress_update", 30, 40, "2026-11-01T17:00:00Z", 15, null,
      crypto.randomUUID(), "America/Havana");
    assert.equal(Date.parse(repeatedMidnight.window_started_at!), Date.parse("2026-11-01T04:00:00Z"));

    await save(mixedBook, "progress_update", 125, 126, at(12));
    const session = await save(mixedBook, "session", 126, 136, at(18, 25), null, at(18));
    const retry = await save(mixedBook, "session", 126, 136, at(18, 25), null, at(18), session.id);
    assert.equal(retry.id, session.id);
    assert.equal(session.reading_time_minutes, 25);
    assert.equal(getLoggedSessionMinutes(await logs(mixedBook), new Date(at(0)), new Date(at(20))), 25);
    await assert.rejects(save(mixedBook, "progress_update", 126, 140, at(20)), /book changed/);
    await assert.rejects(save(mixedBook, "session", 136, 137, at(18, 30), null, at(18, 20)), /overlap/);
    await assert.rejects(save(mixedBook, "session", 136, 137, at(18), null, at(18, 1)), /start before/);
    await assert.rejects(save(mixedBook, "session", 136, 137, at(0), null, at(23, 59, prevDay)), /both times today/);
    await assert.rejects(save(mixedBook, "session", 136, 137, at(0, 0, 1), null, at(23, 59)), /at or before now/);
    await assert.rejects(save(mixedBook, "session", 136, 136, at(19), null, at(18, 30)), /remaining pages/);
    await assert.rejects(save(mixedBook, "session", 136, 181, at(19), null, at(18, 30)), /remaining pages/);
    await assert.rejects(save(missingTotal, "progress_update", 0, 10, at(20)), /total pages/);
    await assert.rejects(save(otherBook, "progress_update", 4, 5, at(20)), /Book unavailable/);
    await assert.rejects(db.query(
      "INSERT INTO reading_logs (user_id, book_id, current_page) VALUES ($1, $2, 8)", [owner, otherBook],
    ), /row-level security/);
    await assert.rejects(db.query(
      "UPDATE reading_logs SET book_id = $1 WHERE id = $2", [otherBook, session.id],
    ), /row-level security/);
    assert.equal((await logs(mixedBook)).length, 2);

    const progressUpdate = await save(mixedBook, "progress_update", 136, 146, at(20), 15);
    assert.equal(Date.parse(progressUpdate.window_started_at!), Date.parse(at(12)));
    const afternoon = (await logs(mixedBook)).slice(1);
    const mixedHabits = calculateReadingHabits(afternoon, at(0), at(23));
    assert.equal(readingPageDeltas(afternoon).reduce((sum, row) => sum + row.pages, 0), 20);
    assert.equal(mixedHabits.weekdays.all.reduce((sum, day) => sum + day.totalMinutes, 0), 40);
    assert.equal(mixedHabits.totalLogs, 1);
    assert.equal(mixedHabits.usualTime.dayParts.reduce((sum, part) => sum + part.minutes, 0), 25);
    const earlierSession = await save(mixedBook, "session", 146, 147, at(17), null, at(16));
    assert.ok(Date.parse(earlierSession.logged_at) < Date.parse(progressUpdate.logged_at));

    await db.exec(`SET test.user_id = '${other}';`);
    assert.deepEqual(await logs(mixedBook), []);
    await assert.rejects(save(mixedBook, "session", 126, 136, at(18, 25), null, at(18), session.id), /Book unavailable/);
    const legacy = () => db.query<{ result: { log: { current_page: number }; book: { status: string; current_page: number } } }>(
      "SELECT save_legacy_reading_log($1, $2, $3, 5, $4, '2026-06-20') AS result",
      [owner, legacyBook, 48, at(17)],
    );
    await assert.rejects(legacy(), /permission denied/);
    await db.exec("RESET ROLE; SET ROLE service_role;");
    const result = (await legacy()).rows[0].result;
    assert.deepEqual(Object.keys(result.log).sort(), ["current_page", "id", "logged_at", "reading_time_minutes"]);
    assert.deepEqual(result.book, { id: legacyBook, status: "Reading", current_page: 48, total_pages: 240 });
    assert.deepEqual((await db.query(
      "SELECT date_started::text FROM books WHERE id = $1", [legacyBook],
    )).rows, [{ date_started: "2026-06-20" }]);

    await db.query("UPDATE books SET status = 'Paused' WHERE id = $1", [legacyBook]);
    await db.query("INSERT INTO book_pause_periods VALUES ($1, $2, null)", [legacyBook, owner]);
    const backdatedLegacy = await db.query<{ result: typeof result }>(
      "SELECT save_legacy_reading_log($1, $2, 30, 10, $3, '2026-06-20') AS result", [owner, legacyBook, at(16)],
    );
    assert.equal(backdatedLegacy.rows[0].result.log.current_page, 30);
    assert.equal(backdatedLegacy.rows[0].result.book.current_page, 48);
    assert.equal(backdatedLegacy.rows[0].result.book.status, "Reading");
    assert.equal((await db.query("SELECT resumed_at FROM book_pause_periods WHERE resumed_at IS NOT NULL")).rows.length, 1);
    await db.query("SELECT save_legacy_reading_log($1, $2, 240, null, null, '2026-06-20')", [owner, legacyBook]);
    assert.deepEqual((await db.query(
      "SELECT status, date_finished::text FROM books WHERE id = $1", [legacyBook],
    )).rows, [{ status: "Finished", date_finished: "2026-06-20" }]);
    await assert.rejects(db.query(
      "SELECT save_legacy_reading_log($1, $2, 50, null, null, '2026-06-20')", [other, legacyBook],
    ), /Book not found/);
    assert.ok((await logs(legacyBook)).every(log => log.kind === "legacy"));
  } finally {
    await db.close();
  }
});

test("mixed and legacy records preserve totals, saved page ranges, and timed-only highlights", () => {
  const entries: ReportLog[] = [
    { id: "old", user_id: owner, book_id: mixedBook, current_page: 100, logged_at: "2026-06-12T12:00:00Z", reading_time_minutes: 15 },
    { id: "update", user_id: owner, book_id: mixedBook, current_page: 125, starting_page: 100,
      kind: "progress_update", logged_at: "2026-06-12T10:00:00Z", reading_time_minutes: 75 },
    { id: "session", user_id: owner, book_id: mixedBook, current_page: 135, starting_page: 125,
      kind: "session", logged_at: "2026-06-12T18:25:00Z", reading_time_minutes: 25 },
    { id: "legacy-after", user_id: owner, book_id: mixedBook, current_page: 145, starting_page: 135,
      kind: "legacy", logged_at: "2026-06-12T19:00:00Z", reading_time_minutes: 10 },
  ];
  const book: ReportBook = {
    id: mixedBook, user_id: owner, title: "A book", authors: [], genres: [], total_pages: 180, rating: null,
    cover_url: null, format: null, language: null, date_finished: null, date_started: null,
  };
  const dashboardBook: Book = { id: mixedBook, user_id: owner, title: book.title, authors: [], status: "Reading",
    current_page: 145, total_pages: 180, is_favorite: false, created_at: "2026-06-11" };
  const period = monthlyPeriod("2026-06", "UTC");
  const report = buildMonthlyReport(owner, period, [book], entries);
  assert.deepEqual(report.totals, { booksFinished: 0, pagesLogged: 145, minutesLogged: 125, readingDays: 1 });
  assert.deepEqual(report.highlights.longestSession, { bookId: mixedBook, minutes: 25 });
  const dashboard = buildAnalyticsDashboardData([dashboardBook], entries, new Date("2026-06-20T12:00:00Z"));
  assert.equal(dashboard.overview.readingMinutes, 125);
  assert.equal(dashboard.hallOfFame.longestSession?.value, "25 min");
  assert.equal(dashboard.habits.averageSessionMinutes, 50 / 3);
});

test("local day and session helpers reject invalid or future times", () => {
  const day = new Date(2026, 5, 20, 20, 15);
  assert.equal(getLocalReadingDay(day).day, "2026-06-20");
  assert.equal(getLocalReadingDay(day).start.getHours(), 0);
  const { start, end } = getSessionTimes(day, 18 * 60, 18 * 60 + 25, day);
  assert.equal((end.getTime() - start.getTime()) / 60_000, 25);
  assert.throws(() => getSessionTimes(day, 19 * 60, 18 * 60, day), /start time before/);
  assert.throws(() => getSessionTimes(day, 19 * 60, 21 * 60, day), /at or before now/);
  assert.throws(() => getSessionTimes(day, 19 * 60, 21 * 60, new Date(2026, 5, 21)), /new day/);
});
