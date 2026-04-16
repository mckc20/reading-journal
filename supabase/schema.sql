-- ============================================================
-- READING JOURNAL — SCHEMA + ROW LEVEL SECURITY
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ============================================================

-- ── SERIES (must come before books — FK dependency) ───────
CREATE TABLE IF NOT EXISTS series (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  journal_content text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── BOOKS ─────────────────────────────────────────────────
-- Uses CHECK constraints rather than PG enums so adding new
-- values never requires a schema migration.
CREATE TABLE IF NOT EXISTS books (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  author          text NOT NULL,
  genres          text[],
  status          text NOT NULL DEFAULT 'Wishlist'
                    CHECK (status IN ('Wishlist','Not Started','Up Next','Reading','Finished','DNF')),
  cover_url       text,
  rating          smallint CHECK (rating BETWEEN 1 AND 5),
  is_favorite     boolean NOT NULL DEFAULT false,
  current_page    integer CHECK (current_page >= 0),
  total_pages     integer CHECK (total_pages > 0),
  date_started    date,
  date_finished   date,
  language        text CHECK (language IN ('German','Spanish','English')),
  belongs_to      text CHECK (belongs_to IN ('Me','Family','Friends','Library')),
  format          text CHECK (format IN ('eBook','Audiobook','Paperback','Hardcover')),
  isbn            text,
  series_id       uuid REFERENCES series(id) ON DELETE SET NULL,
  volume_number   numeric CHECK (volume_number > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── READING LOGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id              uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  current_page         integer NOT NULL CHECK (current_page >= 0),
  reading_time_minutes integer CHECK (reading_time_minutes > 0),
  logged_at            timestamptz NOT NULL DEFAULT now()
);

-- ── INDEXES ───────────────────────────────────────────────
-- All queries are scoped by user_id; compound index on status
-- supports the "currently reading" dashboard card query.
CREATE INDEX IF NOT EXISTS books_user_id_idx        ON books(user_id);
CREATE INDEX IF NOT EXISTS books_status_idx         ON books(user_id, status);
CREATE INDEX IF NOT EXISTS series_user_id_idx       ON series(user_id);
CREATE INDEX IF NOT EXISTS reading_logs_user_id_idx ON reading_logs(user_id);
CREATE INDEX IF NOT EXISTS reading_logs_book_id_idx ON reading_logs(book_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE series       ENABLE ROW LEVEL SECURITY;
ALTER TABLE books        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_logs ENABLE ROW LEVEL SECURITY;

-- series
CREATE POLICY "series: owner select" ON series FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "series: owner insert" ON series FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "series: owner update" ON series FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "series: owner delete" ON series FOR DELETE USING (auth.uid() = user_id);

-- books
CREATE POLICY "books: owner select" ON books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "books: owner insert" ON books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books: owner update" ON books FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "books: owner delete" ON books FOR DELETE USING (auth.uid() = user_id);

-- reading_logs
CREATE POLICY "reading_logs: owner select" ON reading_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reading_logs: owner insert" ON reading_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reading_logs: owner update" ON reading_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reading_logs: owner delete" ON reading_logs FOR DELETE USING (auth.uid() = user_id);
