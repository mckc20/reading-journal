-- ============================================================
-- READING JOURNAL — SCHEMA + ROW LEVEL SECURITY
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ============================================================

-- ── SERIES (must come before books — FK dependency) ───────
CREATE TABLE IF NOT EXISTS series (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'ongoing'
                    CHECK (status IN ('ongoing', 'completed')),
  is_favorite     boolean NOT NULL DEFAULT false,
  cover_url       text,
  journal_content text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── AUTHORS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (btrim(name) <> ''),
  photo_url     text,
  bio           text,
  is_favorite   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── BOOKS ─────────────────────────────────────────────────
-- Uses CHECK constraints rather than PG enums so adding new
-- values never requires a schema migration.
CREATE TABLE IF NOT EXISTS books (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  genres          text[],
  status          text NOT NULL DEFAULT 'To Read'
                    CHECK (status IN ('To Read','Up Next','Reading','Paused','Finished','DNF')),
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
  description text,
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

CREATE TABLE IF NOT EXISTS book_authors (
  book_id   uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  position  integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (book_id, author_id),
  UNIQUE (book_id, position)
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

-- ── BOOK PAUSE PERIODS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_pause_periods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id    uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  paused_at  timestamptz NOT NULL DEFAULT now(),
  resumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (resumed_at IS NULL OR resumed_at >= paused_at)
);

-- ── BOOK JOURNAL ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_journal (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id  text NOT NULL UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id    uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  parent_entry_id uuid REFERENCES book_journal(id) ON DELETE CASCADE,
  label      text NOT NULL CHECK (label IN ('quote','review','note')),
  attribution text,
  content    text NOT NULL CHECK (length(btrim(content)) > 0),
  tags       text[],
  page_start integer CHECK (page_start IS NULL OR page_start > 0),
  is_favorite boolean NOT NULL DEFAULT false,
  entry_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_entry_id IS NULL OR parent_entry_id <> id)
);

-- ── SERIES JOURNAL ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS series_journal (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id  text NOT NULL UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id  uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  parent_entry_id uuid REFERENCES series_journal(id) ON DELETE CASCADE,
  label      text NOT NULL DEFAULT 'note' CHECK (label IN ('quote', 'note', 'review')),
  attribution text,
  content    text NOT NULL CHECK (length(btrim(content)) > 0),
  tags       text[],
  page_start integer CHECK (page_start IS NULL OR page_start > 0),
  is_favorite boolean NOT NULL DEFAULT false,
  entry_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_entry_id IS NULL OR parent_entry_id <> id)
);

-- ── AUTHOR JOURNAL ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS author_journal (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id  text NOT NULL UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  parent_entry_id uuid REFERENCES author_journal(id) ON DELETE CASCADE,
  label      text NOT NULL DEFAULT 'note' CHECK (label IN ('quote', 'note', 'review')),
  attribution text,
  content    text NOT NULL CHECK (length(btrim(content)) > 0),
  tags       text[],
  page_start integer CHECK (page_start IS NULL OR page_start > 0),
  is_favorite boolean NOT NULL DEFAULT false,
  entry_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_entry_id IS NULL OR parent_entry_id <> id)
);

CREATE OR REPLACE FUNCTION generate_journal_entry_public_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM book_journal WHERE public_id = candidate)
      AND NOT EXISTS (SELECT 1 FROM series_journal WHERE public_id = candidate)
      AND NOT EXISTS (SELECT 1 FROM author_journal WHERE public_id = candidate);
  END LOOP;

  RETURN candidate;
END;
$$;

ALTER TABLE book_journal ALTER COLUMN public_id SET DEFAULT generate_journal_entry_public_id();
ALTER TABLE series_journal ALTER COLUMN public_id SET DEFAULT generate_journal_entry_public_id();
ALTER TABLE author_journal ALTER COLUMN public_id SET DEFAULT generate_journal_entry_public_id();

CREATE OR REPLACE FUNCTION ensure_journal_entry_public_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_id IS NULL OR btrim(NEW.public_id) = '' THEN
    NEW.public_id := generate_journal_entry_public_id();
  END IF;

  NEW.public_id := btrim(NEW.public_id);

  IF EXISTS (
    SELECT 1 FROM book_journal
    WHERE public_id = NEW.public_id
      AND (TG_TABLE_NAME <> 'book_journal' OR id <> NEW.id)
  ) OR EXISTS (
    SELECT 1 FROM series_journal
    WHERE public_id = NEW.public_id
      AND (TG_TABLE_NAME <> 'series_journal' OR id <> NEW.id)
  ) OR EXISTS (
    SELECT 1 FROM author_journal
    WHERE public_id = NEW.public_id
      AND (TG_TABLE_NAME <> 'author_journal' OR id <> NEW.id)
  ) THEN
    RAISE unique_violation USING MESSAGE = 'journal entry public_id must be unique';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS book_journal_ensure_public_id ON book_journal;
CREATE TRIGGER book_journal_ensure_public_id
  BEFORE INSERT OR UPDATE OF public_id ON book_journal
  FOR EACH ROW
  EXECUTE FUNCTION ensure_journal_entry_public_id();

DROP TRIGGER IF EXISTS series_journal_ensure_public_id ON series_journal;
CREATE TRIGGER series_journal_ensure_public_id
  BEFORE INSERT OR UPDATE OF public_id ON series_journal
  FOR EACH ROW
  EXECUTE FUNCTION ensure_journal_entry_public_id();

DROP TRIGGER IF EXISTS author_journal_ensure_public_id ON author_journal;
CREATE TRIGGER author_journal_ensure_public_id
  BEFORE INSERT OR UPDATE OF public_id ON author_journal
  FOR EACH ROW
  EXECUTE FUNCTION ensure_journal_entry_public_id();

-- ── JOURNAL ENTRY VISIBILITY ──────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entry_visibility (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('Book','Series','Author')),
  entity_id   uuid NOT NULL,
  source      text NOT NULL CHECK (source IN ('book_note','series_note','author_note','generated_book_event')),
  source_id   text NOT NULL,
  hidden_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id, source, source_id)
);

-- ── JOURNAL MEDIA ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_attachments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path      text NOT NULL,
  thumbnail_path text,
  file_name      text NOT NULL,
  file_type      text NOT NULL CHECK (file_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size      integer NOT NULL CHECK (file_size > 0),
  width          integer CHECK (width IS NULL OR width > 0),
  height         integer CHECK (height IS NULL OR height > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_path)
);

CREATE TABLE IF NOT EXISTS journal_entry_media (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_source text NOT NULL CHECK (journal_entry_source IN ('book_note', 'series_note', 'author_note')),
  journal_entry_id    uuid NOT NULL,
  media_attachment_id uuid NOT NULL REFERENCES media_attachments(id) ON DELETE CASCADE,
  position            integer NOT NULL DEFAULT 1 CHECK (position >= 0),
  caption             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_entry_source, journal_entry_id, media_attachment_id)
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
    "default_reading_status": "To Read",
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
  last_seen_release_note_version text,
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

DROP TRIGGER IF EXISTS authors_set_updated_at ON authors;

CREATE TRIGGER authors_set_updated_at
  BEFORE UPDATE ON authors
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS media_attachments_set_updated_at ON media_attachments;

CREATE TRIGGER media_attachments_set_updated_at
  BEFORE UPDATE ON media_attachments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION delete_journal_entry_media_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  source_name text;
BEGIN
  source_name := TG_ARGV[0];
  DELETE FROM journal_entry_media
  WHERE journal_entry_source = source_name
    AND journal_entry_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS book_journal_delete_media_links ON book_journal;

CREATE TRIGGER book_journal_delete_media_links
  BEFORE DELETE ON book_journal
  FOR EACH ROW
  EXECUTE FUNCTION delete_journal_entry_media_links('book_note');

DROP TRIGGER IF EXISTS series_journal_delete_media_links ON series_journal;

CREATE TRIGGER series_journal_delete_media_links
  BEFORE DELETE ON series_journal
  FOR EACH ROW
  EXECUTE FUNCTION delete_journal_entry_media_links('series_note');

DROP TRIGGER IF EXISTS author_journal_delete_media_links ON author_journal;

CREATE TRIGGER author_journal_delete_media_links
  BEFORE DELETE ON author_journal
  FOR EACH ROW
  EXECUTE FUNCTION delete_journal_entry_media_links('author_note');

CREATE OR REPLACE FUNCTION inherit_book_journal_reply_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_record book_journal%ROWTYPE;
BEGIN
  IF NEW.parent_entry_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_record
  FROM book_journal
  WHERE id = NEW.parent_entry_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.user_id := parent_record.user_id;
  NEW.book_id := parent_record.book_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION inherit_series_journal_reply_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_record series_journal%ROWTYPE;
BEGIN
  IF NEW.parent_entry_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_record
  FROM series_journal
  WHERE id = NEW.parent_entry_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.user_id := parent_record.user_id;
  NEW.series_id := parent_record.series_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION inherit_author_journal_reply_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_record author_journal%ROWTYPE;
BEGIN
  IF NEW.parent_entry_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_record
  FROM author_journal
  WHERE id = NEW.parent_entry_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.user_id := parent_record.user_id;
  NEW.author_id := parent_record.author_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS book_journal_inherit_reply_fields ON book_journal;

CREATE TRIGGER book_journal_inherit_reply_fields
  BEFORE INSERT OR UPDATE OF parent_entry_id ON book_journal
  FOR EACH ROW
  EXECUTE FUNCTION inherit_book_journal_reply_fields();

DROP TRIGGER IF EXISTS series_journal_inherit_reply_fields ON series_journal;

CREATE TRIGGER series_journal_inherit_reply_fields
  BEFORE INSERT OR UPDATE OF parent_entry_id ON series_journal
  FOR EACH ROW
  EXECUTE FUNCTION inherit_series_journal_reply_fields();

DROP TRIGGER IF EXISTS author_journal_inherit_reply_fields ON author_journal;

CREATE TRIGGER author_journal_inherit_reply_fields
  BEFORE INSERT OR UPDATE OF parent_entry_id ON author_journal
  FOR EACH ROW
  EXECUTE FUNCTION inherit_author_journal_reply_fields();

-- ── GROUPS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'group'
    CHECK (kind IN ('direct', 'group')),
  direct_pair_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_memberships (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited')),
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  attachment_type text CHECK (attachment_type IN ('book', 'note', 'author', 'series')),
  attachment_payload jsonb,
  reply_to_message_id uuid REFERENCES group_messages(id) ON DELETE SET NULL,
  reply_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  CHECK (
    deleted_at IS NOT NULL
    OR length(btrim(content)) > 0
    OR (
      attachment_type IS NOT NULL
      AND attachment_payload IS NOT NULL
      AND jsonb_typeof(attachment_payload) = 'object'
    )
  )
);

CREATE TABLE IF NOT EXISTS group_message_reactions (
  message_id uuid NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction = 'heart'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, reaction)
);

-- ── INDEXES ───────────────────────────────────────────────
-- All queries are scoped by user_id; compound index on status
-- supports the "currently reading" dashboard card query.
CREATE INDEX IF NOT EXISTS books_user_id_idx        ON books(user_id);
CREATE INDEX IF NOT EXISTS books_status_idx         ON books(user_id, status);
CREATE INDEX IF NOT EXISTS authors_user_id_idx      ON authors(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS authors_unique_user_name_idx
  ON authors (user_id, lower(name));
CREATE INDEX IF NOT EXISTS authors_is_favorite_idx  ON authors(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS genres_parent_id_idx     ON genres(parent_id);
CREATE INDEX IF NOT EXISTS genres_user_id_idx       ON genres(user_id);
CREATE INDEX IF NOT EXISTS genres_is_system_idx     ON genres(is_system);
CREATE INDEX IF NOT EXISTS book_genres_genre_id_idx ON book_genres(genre_id);
CREATE INDEX IF NOT EXISTS book_authors_author_id_idx ON book_authors(author_id);
CREATE INDEX IF NOT EXISTS book_authors_book_id_idx   ON book_authors(book_id);
CREATE INDEX IF NOT EXISTS series_user_id_idx       ON series(user_id);
CREATE INDEX IF NOT EXISTS reading_logs_user_id_idx ON reading_logs(user_id);
CREATE INDEX IF NOT EXISTS reading_logs_book_id_idx ON reading_logs(book_id);
CREATE INDEX IF NOT EXISTS book_pause_periods_user_id_idx ON book_pause_periods(user_id);
CREATE INDEX IF NOT EXISTS book_pause_periods_book_id_idx ON book_pause_periods(book_id);
CREATE UNIQUE INDEX IF NOT EXISTS book_pause_periods_open_book_idx
  ON book_pause_periods(book_id)
  WHERE resumed_at IS NULL;
CREATE INDEX IF NOT EXISTS book_journal_user_id_idx ON book_journal(user_id);
CREATE INDEX IF NOT EXISTS book_journal_book_id_idx ON book_journal(book_id);
CREATE INDEX IF NOT EXISTS book_journal_parent_entry_id_idx ON book_journal(parent_entry_id);
CREATE INDEX IF NOT EXISTS book_journal_book_created_at_idx ON book_journal(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS book_journal_book_entry_date_idx ON book_journal(book_id, entry_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS series_journal_user_id_idx ON series_journal(user_id);
CREATE INDEX IF NOT EXISTS series_journal_series_id_idx ON series_journal(series_id);
CREATE INDEX IF NOT EXISTS series_journal_parent_entry_id_idx ON series_journal(parent_entry_id);
CREATE INDEX IF NOT EXISTS series_journal_series_entry_date_idx ON series_journal(series_id, entry_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS author_journal_user_id_idx ON author_journal(user_id);
CREATE INDEX IF NOT EXISTS author_journal_author_id_idx ON author_journal(author_id);
CREATE INDEX IF NOT EXISTS author_journal_parent_entry_id_idx ON author_journal(parent_entry_id);
CREATE INDEX IF NOT EXISTS author_journal_author_entry_date_idx ON author_journal(author_id, entry_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS journal_entry_visibility_entity_idx
  ON journal_entry_visibility(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS media_attachments_user_id_idx
  ON media_attachments(user_id);
CREATE INDEX IF NOT EXISTS journal_entry_media_entry_idx
  ON journal_entry_media(journal_entry_source, journal_entry_id, position, created_at);
CREATE INDEX IF NOT EXISTS journal_entry_media_media_attachment_id_idx
  ON journal_entry_media(media_attachment_id);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx ON profiles (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);
CREATE INDEX IF NOT EXISTS groups_kind_idx ON groups(kind);
CREATE UNIQUE INDEX IF NOT EXISTS groups_direct_pair_key_unique_idx
  ON groups (direct_pair_key)
  WHERE kind = 'direct';
CREATE INDEX IF NOT EXISTS group_memberships_user_id_idx ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS group_memberships_group_id_idx ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS group_memberships_last_read_at_idx ON group_memberships(group_id, last_read_at);
CREATE INDEX IF NOT EXISTS group_messages_group_created_at_idx ON group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_messages_sender_id_idx ON group_messages(sender_id);
CREATE INDEX IF NOT EXISTS group_messages_attachment_type_idx
  ON group_messages(attachment_type)
  WHERE attachment_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS group_messages_reply_to_message_id_idx
  ON group_messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS group_message_reactions_user_id_idx
  ON group_message_reactions(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS genres_unique_system_sibling_name_idx
  ON genres (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE is_system = true;

CREATE UNIQUE INDEX IF NOT EXISTS genres_unique_user_sibling_name_idx
  ON genres (user_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE is_system = false;

-- ── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE series       ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE books        ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres       ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_genres  ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_pause_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authors_select_own ON authors;
CREATE POLICY authors_select_own
  ON authors
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS authors_insert_own ON authors;
CREATE POLICY authors_insert_own
  ON authors
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS authors_update_own ON authors;
CREATE POLICY authors_update_own
  ON authors
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS authors_delete_own ON authors;
CREATE POLICY authors_delete_own
  ON authors
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS book_authors_select_own ON book_authors;
CREATE POLICY book_authors_select_own
  ON book_authors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS book_authors_insert_own ON book_authors;
CREATE POLICY book_authors_insert_own
  ON book_authors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS book_authors_update_own ON book_authors;
CREATE POLICY book_authors_update_own
  ON book_authors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS book_authors_delete_own ON book_authors;
CREATE POLICY book_authors_delete_own
  ON book_authors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  );

DROP VIEW IF EXISTS public_profiles;

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

CREATE OR REPLACE FUNCTION direct_pair_key_for(first_user_id uuid, second_user_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN first_user_id < second_user_id THEN first_user_id::text || ':' || second_user_id::text
    ELSE second_user_id::text || ':' || first_user_id::text
  END;
$$;

CREATE OR REPLACE FUNCTION prevent_invalid_direct_group_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  group_kind text;
  active_member_count integer;
BEGIN
  SELECT kind INTO group_kind
  FROM groups
  WHERE id = NEW.group_id;

  IF group_kind <> 'direct' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO active_member_count
    FROM group_memberships
    WHERE group_id = NEW.group_id
      AND status = 'active';
  ELSE
    SELECT count(*) INTO active_member_count
    FROM group_memberships
    WHERE group_id = NEW.group_id
      AND status = 'active'
      AND user_id <> OLD.user_id;
  END IF;

  IF active_member_count >= 2 THEN
    RAISE EXCEPTION 'Direct chats can only have two active members.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_memberships_prevent_invalid_direct ON group_memberships;

CREATE TRIGGER group_memberships_prevent_invalid_direct
  BEFORE INSERT OR UPDATE OF status ON group_memberships
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invalid_direct_group_membership();

CREATE OR REPLACE FUNCTION set_group_message_update_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.content = '';
  ELSIF NEW.deleted_at IS NULL AND NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.edited_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_messages_set_update_fields ON group_messages;

CREATE TRIGGER group_messages_set_update_fields
  BEFORE UPDATE ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_group_message_update_fields();

CREATE OR REPLACE FUNCTION search_public_profiles(search_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.created_at
  FROM profiles
  WHERE auth.uid() IS NOT NULL
    AND profiles.id <> auth.uid()
    AND length(btrim(search_query)) >= 2
    AND (
      profiles.username ILIKE '%' || lower(btrim(search_query)) || '%'
      OR profiles.display_name ILIKE '%' || btrim(search_query) || '%'
    )
  ORDER BY profiles.username NULLS LAST, profiles.display_name NULLS LAST
  LIMIT 8;
$$;

GRANT EXECUTE ON FUNCTION search_public_profiles(text) TO authenticated;

CREATE OR REPLACE FUNCTION get_public_profile_by_username(username_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.created_at
  FROM profiles
  WHERE auth.uid() IS NOT NULL
    AND profiles.username = lower(btrim(username_query))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_public_profile_by_username(text) TO authenticated;

CREATE OR REPLACE FUNCTION get_public_profiles(profile_ids uuid[])
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.created_at
  FROM profiles
  WHERE auth.uid() IS NOT NULL
    AND profiles.id = ANY(profile_ids);
$$;

GRANT EXECUTE ON FUNCTION get_public_profiles(uuid[]) TO authenticated;

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

  INSERT INTO groups (id, name, description, avatar_url, created_by, kind)
  VALUES (
    new_group_id,
    btrim(group_name),
    NULLIF(btrim(group_description), ''),
    NULLIF(btrim(group_avatar_url), ''),
    current_user_id,
    'group'
  );

  INSERT INTO group_memberships (group_id, user_id, role, status, last_read_at)
  VALUES (new_group_id, current_user_id, 'owner', 'active', now());

  RETURN QUERY
  SELECT g.*
  FROM groups AS g
  WHERE g.id = new_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_group_with_owner(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION create_or_get_direct_group(other_user_id uuid)
RETURNS SETOF groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  pair_key text;
  existing_group_id uuid;
  new_group_id uuid := gen_random_uuid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF other_user_id IS NULL OR other_user_id = current_user_id THEN
    RAISE EXCEPTION 'Choose another user to start a chat.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'No app user exists for that profile.';
  END IF;

  INSERT INTO profiles (id)
  VALUES (current_user_id)
  ON CONFLICT (id) DO NOTHING;

  pair_key := direct_pair_key_for(current_user_id, other_user_id);

  SELECT id INTO existing_group_id
  FROM groups
  WHERE kind = 'direct'
    AND direct_pair_key = pair_key
  LIMIT 1;

  IF existing_group_id IS NOT NULL THEN
    INSERT INTO group_memberships (group_id, user_id, role, status, last_read_at)
    VALUES
      (existing_group_id, current_user_id, 'member', 'active', now()),
      (existing_group_id, other_user_id, 'member', 'active', NULL)
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET status = 'active';

    RETURN QUERY
    SELECT g.*
    FROM groups AS g
    WHERE g.id = existing_group_id;
    RETURN;
  END IF;

  INSERT INTO groups (id, name, created_by, kind, direct_pair_key)
  VALUES (new_group_id, 'Direct chat', current_user_id, 'direct', pair_key);

  INSERT INTO group_memberships (group_id, user_id, role, status, last_read_at)
  VALUES
    (new_group_id, current_user_id, 'member', 'active', now()),
    (new_group_id, other_user_id, 'member', 'active', NULL);

  RETURN QUERY
  SELECT g.*
  FROM groups AS g
  WHERE g.id = new_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_or_get_direct_group(uuid) TO authenticated;

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

CREATE OR REPLACE FUNCTION pause_book(book_uuid uuid)
RETURNS SETOF books
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  UPDATE books
  SET status = 'Paused'
  WHERE id = book_uuid
    AND user_id = current_user_id
    AND status = 'Reading';

  IF FOUND THEN
    INSERT INTO book_pause_periods (user_id, book_id, paused_at)
    VALUES (current_user_id, book_uuid, now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT books.*
  FROM books
  WHERE id = book_uuid
    AND user_id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION pause_book(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION resume_book(book_uuid uuid)
RETURNS SETOF books
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  UPDATE book_pause_periods
  SET resumed_at = now()
  WHERE book_id = book_uuid
    AND user_id = current_user_id
    AND resumed_at IS NULL;

  UPDATE books
  SET status = 'Reading'
  WHERE id = book_uuid
    AND user_id = current_user_id
    AND status = 'Paused';

  RETURN QUERY
  SELECT books.*
  FROM books
  WHERE id = book_uuid
    AND user_id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION resume_book(uuid) TO authenticated;

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

-- book_pause_periods
CREATE POLICY "book_pause_periods: owner select"
  ON book_pause_periods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "book_pause_periods: owner insert"
  ON book_pause_periods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "book_pause_periods: owner update"
  ON book_pause_periods FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "book_pause_periods: owner delete"
  ON book_pause_periods FOR DELETE
  USING (auth.uid() = user_id);

-- book_journal
CREATE POLICY "book_journal: owner select"
  ON book_journal FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "book_journal: owner insert"
  ON book_journal FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_journal.book_id
        AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "book_journal: owner update"
  ON book_journal FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_journal.book_id
        AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "book_journal: owner delete"
  ON book_journal FOR DELETE
  USING (auth.uid() = user_id);

-- series_journal
CREATE POLICY "series_journal: owner select"
  ON series_journal FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "series_journal: owner insert"
  ON series_journal FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM series
      WHERE series.id = series_journal.series_id
        AND series.user_id = auth.uid()
    )
  );

CREATE POLICY "series_journal: owner update"
  ON series_journal FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM series
      WHERE series.id = series_journal.series_id
        AND series.user_id = auth.uid()
    )
  );

CREATE POLICY "series_journal: owner delete"
  ON series_journal FOR DELETE
  USING (auth.uid() = user_id);

-- author_journal
CREATE POLICY "author_journal: owner select"
  ON author_journal FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "author_journal: owner insert"
  ON author_journal FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = author_journal.author_id
        AND authors.user_id = auth.uid()
    )
  );

CREATE POLICY "author_journal: owner update"
  ON author_journal FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = author_journal.author_id
        AND authors.user_id = auth.uid()
    )
  );

CREATE POLICY "author_journal: owner delete"
  ON author_journal FOR DELETE
  USING (auth.uid() = user_id);

-- journal_entry_visibility
CREATE POLICY "journal_entry_visibility: owner select"
  ON journal_entry_visibility FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "journal_entry_visibility: owner insert"
  ON journal_entry_visibility FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_entry_visibility: owner delete"
  ON journal_entry_visibility FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION user_owns_journal_entry(
  entry_source text,
  entry_id uuid,
  owner_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE entry_source
    WHEN 'book_note' THEN EXISTS (
      SELECT 1 FROM book_journal
      WHERE id = entry_id AND user_id = owner_id
    )
    WHEN 'series_note' THEN EXISTS (
      SELECT 1 FROM series_journal
      WHERE id = entry_id AND user_id = owner_id
    )
    WHEN 'author_note' THEN EXISTS (
      SELECT 1 FROM author_journal
      WHERE id = entry_id AND user_id = owner_id
    )
    ELSE false
  END
$$;

CREATE POLICY "media_attachments: owner select"
  ON media_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "media_attachments: owner insert"
  ON media_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "media_attachments: owner update"
  ON media_attachments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "media_attachments: owner delete"
  ON media_attachments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "journal_entry_media: owner select"
  ON journal_entry_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  );

CREATE POLICY "journal_entry_media: owner insert"
  ON journal_entry_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  );

CREATE POLICY "journal_entry_media: owner update"
  ON journal_entry_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  );

CREATE POLICY "journal_entry_media: owner delete"
  ON journal_entry_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  );

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
    (
      can_manage_group(group_id, auth.uid())
      AND EXISTS (
        SELECT 1
        FROM groups
        WHERE groups.id = group_memberships.group_id
          AND kind = 'group'
      )
    )
    OR (
      auth.uid() = user_id
      AND role = 'owner'
      AND status = 'active'
      AND is_group_creator(group_id, auth.uid())
    )
  );

CREATE POLICY "group_memberships: manager update" ON group_memberships
  FOR UPDATE
  USING (
    can_manage_group(group_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM groups
      WHERE groups.id = group_memberships.group_id
        AND kind = 'group'
    )
  )
  WITH CHECK (
    can_manage_group(group_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM groups
      WHERE groups.id = group_memberships.group_id
        AND kind = 'group'
    )
  );

CREATE POLICY "group_memberships: self delete" ON group_memberships
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "group_memberships: owner delete" ON group_memberships
  FOR DELETE
  USING (is_group_owner(group_id, auth.uid()));

CREATE OR REPLACE FUNCTION mark_group_read(group_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF NOT is_active_group_member(group_uuid, current_user_id) THEN
    RAISE EXCEPTION 'You must be an active group member.';
  END IF;

  UPDATE group_memberships
  SET last_read_at = now()
  WHERE group_id = group_uuid
    AND user_id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_group_read(uuid) TO authenticated;

-- group_messages
CREATE POLICY "group_messages: member select"
  ON group_messages FOR SELECT
  USING (is_active_group_member(group_id, auth.uid()));

CREATE POLICY "group_messages: member insert"
  ON group_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND deleted_at IS NULL
    AND edited_at IS NULL
    AND is_active_group_member(group_id, auth.uid())
  );

CREATE POLICY "group_messages: sender update"
  ON group_messages FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND is_active_group_member(group_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND is_active_group_member(group_id, auth.uid())
  );

CREATE POLICY "group_messages: sender delete"
  ON group_messages FOR DELETE
  USING (
    auth.uid() = sender_id
    AND is_active_group_member(group_id, auth.uid())
  );

CREATE POLICY "group_message_reactions: member select"
  ON group_message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM group_messages
      WHERE group_messages.id = group_message_reactions.message_id
        AND is_active_group_member(group_messages.group_id, auth.uid())
    )
  );

CREATE POLICY "group_message_reactions: member insert own"
  ON group_message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM group_messages
      WHERE group_messages.id = group_message_reactions.message_id
        AND group_messages.deleted_at IS NULL
        AND is_active_group_member(group_messages.group_id, auth.uid())
    )
  );

CREATE POLICY "group_message_reactions: member delete own"
  ON group_message_reactions FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM group_messages
      WHERE group_messages.id = group_message_reactions.message_id
        AND is_active_group_member(group_messages.group_id, auth.uid())
    )
  );

-- ── STORAGE ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-media', 'journal-media', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS journal_media_select_own ON storage.objects;
CREATE POLICY journal_media_select_own
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS journal_media_insert_own ON storage.objects;
CREATE POLICY journal_media_insert_own
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS journal_media_update_own ON storage.objects;
CREATE POLICY journal_media_update_own
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS journal_media_delete_own ON storage.objects;
CREATE POLICY journal_media_delete_own
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('author-photos', 'author-photos', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS author_photos_public_read ON storage.objects;
CREATE POLICY author_photos_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'author-photos');

DROP POLICY IF EXISTS author_photos_insert_own ON storage.objects;
CREATE POLICY author_photos_insert_own
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'author-photos'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS author_photos_update_own ON storage.objects;
CREATE POLICY author_photos_update_own
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'author-photos'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'author-photos'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS author_photos_delete_own ON storage.objects;
CREATE POLICY author_photos_delete_own
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'author-photos'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('series-banners', 'series-banners', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS series_banners_public_read ON storage.objects;
CREATE POLICY series_banners_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'series-banners');

DROP POLICY IF EXISTS series_banners_insert_own ON storage.objects;
CREATE POLICY series_banners_insert_own
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'series-banners'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS series_banners_update_own ON storage.objects;
CREATE POLICY series_banners_update_own
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'series-banners'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'series-banners'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS series_banners_delete_own ON storage.objects;
CREATE POLICY series_banners_delete_own
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'series-banners'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS profile_avatars_public_read ON storage.objects;
CREATE POLICY profile_avatars_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS profile_avatars_insert_own ON storage.objects;
CREATE POLICY profile_avatars_insert_own
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_update_own ON storage.objects;
CREATE POLICY profile_avatars_update_own
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profile-avatars'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_delete_own ON storage.objects;
CREATE POLICY profile_avatars_delete_own
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-avatars'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );
