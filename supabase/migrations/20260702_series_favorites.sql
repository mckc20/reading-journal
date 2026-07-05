ALTER TABLE series
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS series_user_favorite_idx
  ON series(user_id, is_favorite DESC, name);
