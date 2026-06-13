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
  source          text CHECK (source IN ('Owned','Family','Friends','Library')),
  format          text CHECK (format IN ('eBook','Audiobook','Paperback','Hardcover')),
  isbn            text,
  publisher       text,
  publication_date date,
  publication_date_precision text CHECK (publication_date_precision IN ('year','month','day')),
  description     text,
  metadata_source text CHECK (metadata_source IN ('open_library','google_books')),
  metadata_source_url text,
  series_id       uuid REFERENCES series(id) ON DELETE SET NULL,
  volume_number   numeric CHECK (volume_number > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── GENRES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS genres (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (btrim(name) <> ''),
  parent_id  uuid REFERENCES genres(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_system  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (is_system = true AND user_id IS NULL)
    OR (is_system = false AND user_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS book_genres (
  book_id  uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  genre_id uuid NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, genre_id)
);

DO $$
DECLARE
  genre_record record;
  parent_genre_id uuid;
BEGIN
  FOR genre_record IN
    SELECT *
    FROM (
      VALUES
        ('Fiction', NULL, 0),
        ('Non-Fiction', NULL, 0),
        ('Age Target', NULL, 0),

        ('Literary Fiction', 'Fiction', 1),
        ('Contemporary Fiction', 'Fiction', 1),
        ('Historical Fiction', 'Fiction', 1),
        ('Romance', 'Fiction', 1),
        ('Mystery & Crime', 'Fiction', 1),
        ('Thriller & Suspense', 'Fiction', 1),
        ('Science Fiction', 'Fiction', 1),
        ('Fantasy', 'Fiction', 1),
        ('Horror', 'Fiction', 1),
        ('Action & Adventure', 'Fiction', 1),
        ('Humor & Satire', 'Fiction', 1),

        ('Biography & Memoir', 'Non-Fiction', 1),
        ('History', 'Non-Fiction', 1),
        ('True Crime', 'Non-Fiction', 1),
        ('Politics & Current Events', 'Non-Fiction', 1),
        ('Self-Help & Personal Development', 'Non-Fiction', 1),
        ('Business & Economics', 'Non-Fiction', 1),
        ('Science & Technology', 'Non-Fiction', 1),
        ('Philosophy & Spirituality', 'Non-Fiction', 1),
        ('Health & Wellness', 'Non-Fiction', 1),
        ('Travel', 'Non-Fiction', 1),
        ('Cookbooks & Food', 'Non-Fiction', 1),
        ('Art, Photography & Design', 'Non-Fiction', 1),
        ('Essays & Anthologies', 'Non-Fiction', 1),

        ('Children''s', 'Age Target', 1),
        ('Middle Grade', 'Age Target', 1),
        ('Young Adult', 'Age Target', 1),
        ('New Adult', 'Age Target', 1),
        ('Adult', 'Age Target', 1),

        ('Space Opera', 'Science Fiction', 2),
        ('Dystopian', 'Science Fiction', 2),
        ('Hard Sci-Fi', 'Science Fiction', 2),
        ('High Fantasy', 'Fantasy', 2),
        ('Epic Fantasy', 'Fantasy', 2),
        ('Urban Fantasy', 'Fantasy', 2),
        ('Popular Science', 'Science & Technology', 2),
        ('Nature & Environment', 'Science & Technology', 2)
    ) AS genres_to_seed(name, parent_name, sort_order)
    ORDER BY sort_order, name
  LOOP
    IF genre_record.parent_name IS NULL THEN
      parent_genre_id := NULL;
    ELSE
      SELECT id INTO parent_genre_id
      FROM genres
      WHERE is_system = true
        AND name = genre_record.parent_name
      LIMIT 1;
    END IF;

    INSERT INTO genres (name, parent_id, user_id, is_system)
    VALUES (genre_record.name, parent_genre_id, NULL, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

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
CREATE INDEX IF NOT EXISTS genres_parent_id_idx     ON genres(parent_id);
CREATE INDEX IF NOT EXISTS genres_user_id_idx       ON genres(user_id);
CREATE INDEX IF NOT EXISTS genres_is_system_idx     ON genres(is_system);
CREATE INDEX IF NOT EXISTS book_genres_genre_id_idx ON book_genres(genre_id);
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

CREATE UNIQUE INDEX IF NOT EXISTS genres_unique_system_sibling_name_idx
  ON genres (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE is_system = true;

CREATE UNIQUE INDEX IF NOT EXISTS genres_unique_user_sibling_name_idx
  ON genres (user_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE is_system = false;

-- ── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE series       ENABLE ROW LEVEL SECURITY;
ALTER TABLE books        ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres       ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_genres  ENABLE ROW LEVEL SECURITY;
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

CREATE OR REPLACE FUNCTION prevent_genre_cycles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_parent uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A genre cannot be its own parent.';
  END IF;

  current_parent := NEW.parent_id;

  WHILE current_parent IS NOT NULL LOOP
    IF current_parent = NEW.id THEN
      RAISE EXCEPTION 'A genre cannot be moved below one of its own descendants.';
    END IF;

    SELECT parent_id INTO current_parent
    FROM genres
    WHERE id = current_parent;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS genres_prevent_cycles ON genres;

CREATE TRIGGER genres_prevent_cycles
  BEFORE INSERT OR UPDATE OF parent_id ON genres
  FOR EACH ROW
  EXECUTE FUNCTION prevent_genre_cycles();

DROP TRIGGER IF EXISTS genres_set_updated_at ON genres;

CREATE TRIGGER genres_set_updated_at
  BEFORE UPDATE ON genres
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION can_use_genre(genre_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM genres
    WHERE id = genre_uuid
      AND (is_system = true OR user_id = user_uuid)
  );
$$;

CREATE OR REPLACE FUNCTION can_use_genre_parent(parent_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT parent_uuid IS NULL OR can_use_genre(parent_uuid, user_uuid);
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

-- genres
CREATE POLICY "genres: visible select"
  ON genres FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "genres: owner insert custom"
  ON genres FOR INSERT
  WITH CHECK (
    is_system = false
    AND auth.uid() = user_id
    AND can_use_genre_parent(parent_id, auth.uid())
  );

CREATE POLICY "genres: owner update custom"
  ON genres FOR UPDATE
  USING (is_system = false AND auth.uid() = user_id)
  WITH CHECK (
    is_system = false
    AND auth.uid() = user_id
    AND can_use_genre_parent(parent_id, auth.uid())
  );

CREATE POLICY "genres: owner delete custom"
  ON genres FOR DELETE
  USING (is_system = false AND auth.uid() = user_id);

-- book_genres
CREATE POLICY "book_genres: owner select"
  ON book_genres FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_genres.book_id
        AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "book_genres: owner insert"
  ON book_genres FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_genres.book_id
        AND books.user_id = auth.uid()
    )
    AND can_use_genre(genre_id, auth.uid())
  );

CREATE POLICY "book_genres: owner delete"
  ON book_genres FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_genres.book_id
        AND books.user_id = auth.uid()
    )
  );

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
