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

-- ── BOOK NOTES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id    uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  label      text NOT NULL CHECK (label IN ('quote','review','note')),
  title      text,
  quote_speaker text,
  content    text NOT NULL CHECK (length(btrim(content)) > 0),
  page_start integer CHECK (page_start IS NULL OR page_start > 0),
  is_favorite boolean NOT NULL DEFAULT false,
  note_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── PROFILES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  bio text,
  timezone text,
  language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_username_format_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_username_format_check
      CHECK (
        username IS NULL
        OR (
          username = lower(username)
          AND username ~ '^[a-z0-9_]{3,30}$'
        )
      );
  END IF;
END;
$$;

INSERT INTO profiles (id)
SELECT users.id
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user_profile();

-- ── USER SETTINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  appearance jsonb NOT NULL DEFAULT '{
    "theme": "system",
    "accent_color": "default",
    "compact_mode": false,
    "reduced_animations": false,
    "book_cover_style": "rounded",
    "corner_radius": "medium",
    "font_size": "medium",
    "density": "comfortable"
  }'::jsonb,
  reading jsonb NOT NULL DEFAULT '{
    "default_reading_status": "Wishlist",
    "reading_pace_calculation": "recent_logs",
    "progress_display": "percentage",
    "reading_streak_enabled": true,
    "reading_streak_goal_days": 7,
    "auto_finish_books": true,
    "estimated_completion_dates": true
  }'::jsonb,
  library jsonb NOT NULL DEFAULT '{
    "default_sorting": "recently_added",
    "default_view": "grid",
    "default_filters": {},
    "show_unfinished_series_first": true,
    "hide_completed_books": false,
    "show_reading_statistics": true
  }'::jsonb,
  collections jsonb NOT NULL DEFAULT '{
    "collection_visibility": "private",
    "automatic_collections": true,
    "smart_collections": true,
    "collection_behavior": "manual_and_smart"
  }'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{
    "reading_reminders": false,
    "weekly_summary": false,
    "daily_goal_reminders": false,
    "goal_completion_notifications": true,
    "friend_activity_notifications": false,
    "new_follower_notifications": false
  }'::jsonb,
  privacy jsonb NOT NULL DEFAULT '{
    "private_account": true,
    "show_reading_activity": false,
    "show_reading_statistics_publicly": false,
    "show_reading_goals_publicly": false,
    "allow_followers": false,
    "blocked_users": []
  }'::jsonb,
  backup jsonb NOT NULL DEFAULT '{
    "automatic_backups": false,
    "backup_frequency": "manual",
    "last_backup_at": null
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(appearance) = 'object'),
  CHECK (jsonb_typeof(reading) = 'object'),
  CHECK (jsonb_typeof(library) = 'object'),
  CHECK (jsonb_typeof(collections) = 'object'),
  CHECK (jsonb_typeof(notifications) = 'object'),
  CHECK (jsonb_typeof(privacy) = 'object'),
  CHECK (jsonb_typeof(backup) = 'object')
);

INSERT INTO user_settings (user_id)
SELECT users.id
FROM auth.users AS users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_set_updated_at ON user_settings;

CREATE TRIGGER user_settings_set_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

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
CREATE INDEX IF NOT EXISTS book_notes_user_id_idx ON book_notes(user_id);
CREATE INDEX IF NOT EXISTS book_notes_book_id_idx ON book_notes(book_id);
CREATE INDEX IF NOT EXISTS book_notes_book_created_at_idx ON book_notes(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS book_notes_book_note_date_idx ON book_notes(book_id, note_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx ON profiles (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);
CREATE INDEX IF NOT EXISTS group_memberships_user_id_idx ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS group_memberships_group_id_idx ON group_memberships(group_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE series       ENABLE ROW LEVEL SECURITY;
ALTER TABLE books        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
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

CREATE OR REPLACE FUNCTION create_group_with_owner(
  group_name text,
  group_description text DEFAULT NULL,
  group_avatar_url text DEFAULT NULL
)
RETURNS SETOF groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  new_group_id uuid := gen_random_uuid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF NULLIF(btrim(group_name), '') IS NULL THEN
    RAISE EXCEPTION 'Group name is required.';
  END IF;

  INSERT INTO profiles (id)
  VALUES (current_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO groups (id, name, description, avatar_url, created_by)
  VALUES (
    new_group_id,
    btrim(group_name),
    NULLIF(btrim(group_description), ''),
    NULLIF(btrim(group_avatar_url), ''),
    current_user_id
  );

  INSERT INTO group_memberships (group_id, user_id, role, status)
  VALUES (new_group_id, current_user_id, 'owner', 'active');

  RETURN QUERY
  SELECT g.*
  FROM groups AS g
  WHERE g.id = new_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_group_with_owner(text, text, text) TO authenticated;

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

-- book_notes
CREATE POLICY "book_notes: owner select"
  ON book_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "book_notes: owner insert"
  ON book_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_notes.book_id
        AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "book_notes: owner update"
  ON book_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_notes.book_id
        AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "book_notes: owner delete"
  ON book_notes FOR DELETE
  USING (auth.uid() = user_id);

-- profiles
CREATE POLICY "profiles: owner select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: owner insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: owner update" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_settings
CREATE POLICY "user_settings: owner select" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings: owner insert" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings: owner update" ON user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings: owner delete" ON user_settings FOR DELETE USING (auth.uid() = user_id);

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
