-- Pause/resume support for books.

ALTER TABLE books
  DROP CONSTRAINT IF EXISTS books_status_check;

ALTER TABLE books
  ADD CONSTRAINT books_status_check
  CHECK (status IN ('Wishlist','Not Started','Up Next','Reading','Paused','Finished','DNF'));

CREATE TABLE IF NOT EXISTS book_pause_periods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id    uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  paused_at  timestamptz NOT NULL DEFAULT now(),
  resumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (resumed_at IS NULL OR resumed_at >= paused_at)
);

CREATE INDEX IF NOT EXISTS book_pause_periods_user_id_idx ON book_pause_periods(user_id);
CREATE INDEX IF NOT EXISTS book_pause_periods_book_id_idx ON book_pause_periods(book_id);
CREATE UNIQUE INDEX IF NOT EXISTS book_pause_periods_open_book_idx
  ON book_pause_periods(book_id)
  WHERE resumed_at IS NULL;

ALTER TABLE book_pause_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "book_pause_periods: owner select" ON book_pause_periods;
DROP POLICY IF EXISTS "book_pause_periods: owner insert" ON book_pause_periods;
DROP POLICY IF EXISTS "book_pause_periods: owner update" ON book_pause_periods;
DROP POLICY IF EXISTS "book_pause_periods: owner delete" ON book_pause_periods;

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

NOTIFY pgrst, 'reload schema';
