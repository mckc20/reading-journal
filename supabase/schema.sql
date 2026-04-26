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
  authors         text[] NOT NULL CHECK (cardinality(authors) > 0),
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
  metadata_source text CHECK (metadata_source IN ('open_library','google_books')),
  metadata_source_url text,
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

-- ── PROFILES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  avatar_url text,
  bio text,
  timezone text,
  language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── GROUPS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_memberships (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- ── INDEXES ───────────────────────────────────────────────
-- All queries are scoped by user_id; compound index on status
-- supports the "currently reading" dashboard card query.
CREATE INDEX IF NOT EXISTS books_user_id_idx        ON books(user_id);
CREATE INDEX IF NOT EXISTS books_status_idx         ON books(user_id, status);
CREATE INDEX IF NOT EXISTS series_user_id_idx       ON series(user_id);
CREATE INDEX IF NOT EXISTS reading_logs_user_id_idx ON reading_logs(user_id);
CREATE INDEX IF NOT EXISTS reading_logs_book_id_idx ON reading_logs(book_id);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles(created_at);
CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);
CREATE INDEX IF NOT EXISTS group_memberships_user_id_idx ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS group_memberships_group_id_idx ON group_memberships(group_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE series       ENABLE ROW LEVEL SECURITY;
ALTER TABLE books        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_active_group_member(group_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_id = group_uuid
      AND user_id = user_uuid
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION can_manage_group(group_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_id = group_uuid
      AND user_id = user_uuid
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_group_owner(group_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_id = group_uuid
      AND user_id = user_uuid
      AND role = 'owner'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_group_creator(group_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM groups
    WHERE id = group_uuid
      AND created_by = user_uuid
  );
$$;

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

-- profiles
CREATE POLICY "profiles: owner select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: owner insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: owner update" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- groups
CREATE POLICY "groups: member select" ON groups FOR SELECT USING (is_active_group_member(id, auth.uid()));
CREATE POLICY "groups: owner insert" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups: manager update" ON groups FOR UPDATE USING (can_manage_group(id, auth.uid())) WITH CHECK (can_manage_group(id, auth.uid()));
CREATE POLICY "groups: owner delete" ON groups FOR DELETE USING (is_group_owner(id, auth.uid()));

-- group_memberships
CREATE POLICY "group_memberships: member select" ON group_memberships
  FOR SELECT
  USING (is_active_group_member(group_id, auth.uid()));

CREATE POLICY "group_memberships: manager insert" ON group_memberships
  FOR INSERT
  WITH CHECK (
    can_manage_group(group_id, auth.uid())
    OR (
      auth.uid() = user_id
      AND role = 'owner'
      AND status = 'active'
      AND is_group_creator(group_id, auth.uid())
    )
  );

CREATE POLICY "group_memberships: manager update" ON group_memberships
  FOR UPDATE
  USING (can_manage_group(group_id, auth.uid()))
  WITH CHECK (can_manage_group(group_id, auth.uid()));

CREATE POLICY "group_memberships: self delete" ON group_memberships
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "group_memberships: owner delete" ON group_memberships
  FOR DELETE
  USING (is_group_owner(group_id, auth.uid()));
