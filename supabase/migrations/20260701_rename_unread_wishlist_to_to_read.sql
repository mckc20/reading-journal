-- Rename book statuses "Wishlist" and "Unread" to "To Read".
-- "Not Started" is included defensively for databases that missed the earlier rename.

ALTER TABLE books
  DROP CONSTRAINT IF EXISTS books_status_check;

UPDATE books
SET status = 'To Read'
WHERE status IN ('Wishlist', 'Unread', 'Not Started');

ALTER TABLE books
  ALTER COLUMN status SET DEFAULT 'To Read';

UPDATE user_settings
SET reading = jsonb_set(reading, '{default_reading_status}', '"To Read"', false)
WHERE reading ->> 'default_reading_status' IN ('Wishlist', 'Unread', 'Not Started');

ALTER TABLE books
  ADD CONSTRAINT books_status_check
  CHECK (status IN ('To Read','Up Next','Reading','Paused','Finished','DNF'));

NOTIFY pgrst, 'reload schema';
