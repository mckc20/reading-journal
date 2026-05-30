-- User-facing settings for profile identity, appearance, reading behavior, and privacy.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS username text;

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

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON profiles (lower(username))
  WHERE username IS NOT NULL;

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

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings: owner select" ON user_settings;
DROP POLICY IF EXISTS "user_settings: owner insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings: owner update" ON user_settings;
DROP POLICY IF EXISTS "user_settings: owner delete" ON user_settings;

CREATE POLICY "user_settings: owner select"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings: owner insert"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings: owner update"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings: owner delete"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);
