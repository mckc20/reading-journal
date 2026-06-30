-- Rename the book status "Not Started" to "Unread".

ALTER TABLE books
  DROP CONSTRAINT IF EXISTS books_status_check;

UPDATE books
SET status = 'Unread'
WHERE status = 'Not Started';

UPDATE user_settings
SET reading = jsonb_set(reading, '{default_reading_status}', '"Unread"', false)
WHERE reading ->> 'default_reading_status' = 'Not Started';

ALTER TABLE books
  ADD CONSTRAINT books_status_check
  CHECK (status IN ('Wishlist','Unread','Up Next','Reading','Paused','Finished','DNF'));

NOTIFY pgrst, 'reload schema';
