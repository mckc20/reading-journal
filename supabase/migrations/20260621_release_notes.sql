-- One-time release notes shown after login until the user acknowledges them.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS last_seen_release_note_version text;
