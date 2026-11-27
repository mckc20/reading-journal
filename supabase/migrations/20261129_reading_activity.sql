BEGIN;

ALTER TABLE public.reading_logs
  ADD COLUMN kind text NOT NULL DEFAULT 'legacy',
  ADD COLUMN starting_page integer,
  ADD COLUMN local_day date,
  ADD COLUMN time_zone text,
  ADD COLUMN window_started_at timestamptz,
  ADD COLUMN session_started_at timestamptz,
  ADD CONSTRAINT reading_logs_activity_check CHECK (
    (kind = 'legacy' AND (starting_page IS NULL OR starting_page >= 0) AND local_day IS NULL AND time_zone IS NULL
      AND window_started_at IS NULL AND session_started_at IS NULL)
    OR (
      starting_page IS NOT NULL AND starting_page >= 0 AND current_page > starting_page
      AND local_day IS NOT NULL AND time_zone IS NOT NULL
      AND (
        (kind = 'progress_update' AND window_started_at IS NOT NULL
          AND window_started_at <= logged_at AND session_started_at IS NULL)
        OR (kind = 'session' AND window_started_at IS NULL AND session_started_at IS NOT NULL
          AND session_started_at < logged_at AND reading_time_minutes IS NOT NULL
          AND reading_time_minutes > 0
          AND extract(epoch FROM logged_at - session_started_at) = reading_time_minutes * 60::bigint)
      )
    )
  );

CREATE INDEX reading_logs_activity_day_idx
  ON public.reading_logs (book_id, user_id, local_day, logged_at, id) WHERE kind <> 'legacy';

-- Keep the log's owner and the linked book's owner in agreement for direct writes.
DROP POLICY "reading_logs: owner insert" ON public.reading_logs;
DROP POLICY "reading_logs: owner update" ON public.reading_logs;
CREATE POLICY "reading_logs: owner insert" ON public.reading_logs FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.books WHERE id = book_id AND user_id = auth.uid())
);
CREATE POLICY "reading_logs: owner update" ON public.reading_logs FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.books WHERE id = book_id AND user_id = auth.uid())
  );

CREATE FUNCTION public.save_reading_activity(
  target_book uuid, log_id uuid, activity_kind text, expected_page integer, target_page integer,
  minutes integer, activity_at timestamptz, session_start timestamptz, reader_zone text
) RETURNS public.reading_logs
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  book public.books%ROWTYPE;
  entry public.reading_logs%ROWTYPE;
  following_update public.reading_logs%ROWTYPE;
  now_at timestamptz;
  end_at timestamptz;
  day_key date;
  midnight_at timestamptz;
  previous_update_at timestamptz;
  duration_minutes integer;
  base_page integer;
BEGIN
  SELECT * INTO book FROM public.books
  WHERE id = target_book AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book unavailable.' USING ERRCODE = 'P0002';
  END IF;

  -- Check for a committed retry before validating against the now-updated book.
  SELECT * INTO entry FROM public.reading_logs
  WHERE id = log_id AND book_id = target_book AND user_id = owner_id;
  IF FOUND THEN
    RETURN entry;
  END IF;

  base_page := coalesce(book.current_page, 0);
  IF base_page IS DISTINCT FROM expected_page OR book.status <> 'Reading' THEN
    RAISE EXCEPTION 'The book changed. Review its current position before saving.' USING ERRCODE = 'PT409';
  END IF;
  IF book.total_pages IS NULL THEN
    RAISE EXCEPTION 'Set the total pages to track progress.' USING ERRCODE = '22023';
  END IF;
  IF log_id IS NULL OR target_page IS NULL OR target_page <= base_page OR target_page > book.total_pages THEN
    RAISE EXCEPTION 'Choose a page within the remaining pages of the book.' USING ERRCODE = '22023';
  END IF;
  IF reader_zone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = reader_zone) THEN
    RAISE EXCEPTION 'Choose a valid local time zone.' USING ERRCODE = '22023';
  END IF;

  now_at := clock_timestamp();
  end_at := coalesce(activity_at, now_at);
  day_key := (end_at AT TIME ZONE reader_zone)::date;
  IF NOT isfinite(end_at) OR end_at > now_at THEN
    RAISE EXCEPTION 'Choose an end time at or before now.' USING ERRCODE = '22023';
  END IF;

  IF activity_kind = 'progress_update' THEN
    IF session_start IS NOT NULL OR minutes < 0 THEN
      RAISE EXCEPTION 'Choose a valid reading duration.' USING ERRCODE = '22023';
    END IF;
    duration_minutes := minutes;
    -- A time zone can repeat midnight. The last second of yesterday finds the first occurrence.
    midnight_at := least(day_key::timestamp AT TIME ZONE reader_zone,
      ((day_key::timestamp - interval '1 second') AT TIME ZONE reader_zone) + interval '1 second');

    SELECT logged_at INTO previous_update_at FROM public.reading_logs
    WHERE book_id = target_book AND user_id = owner_id AND kind = 'progress_update'
      AND local_day = day_key AND (logged_at, id) < (end_at, log_id)
    ORDER BY logged_at DESC, id DESC LIMIT 1;
  ELSIF activity_kind = 'session' THEN
    IF activity_at IS NULL OR session_start IS NULL OR NOT isfinite(session_start)
      OR session_start >= end_at OR day_key <> (now_at AT TIME ZONE reader_zone)::date
      OR (session_start AT TIME ZONE reader_zone)::date <> day_key
      OR mod(extract(epoch FROM end_at - session_start), 60) <> 0 THEN
      RAISE EXCEPTION 'Choose a start before the end, with both times today.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.reading_logs
      WHERE book_id = target_book AND user_id = owner_id AND kind = 'session'
        AND logged_at > session_start AND session_started_at < end_at
    ) THEN
      RAISE EXCEPTION 'These times overlap a session already logged for this book.' USING ERRCODE = '22023';
    END IF;
    duration_minutes := (extract(epoch FROM end_at - session_start) / 60)::integer;
  ELSE
    RAISE EXCEPTION 'Choose a valid reading action.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.reading_logs (
    id, user_id, book_id, current_page, reading_time_minutes, logged_at, kind,
    starting_page, local_day, time_zone, window_started_at, session_started_at
  ) VALUES (
    log_id, owner_id, target_book, target_page, duration_minutes, end_at, activity_kind,
    base_page, day_key, reader_zone,
    CASE WHEN activity_kind = 'progress_update' THEN least(end_at, greatest(midnight_at, previous_update_at)) END,
    session_start
  ) RETURNING * INTO entry;

  IF activity_kind = 'progress_update' THEN
    SELECT * INTO following_update FROM public.reading_logs
    WHERE book_id = target_book AND user_id = owner_id AND kind = 'progress_update'
      AND local_day = day_key AND (logged_at, id) > (end_at, log_id)
    ORDER BY logged_at, id LIMIT 1;

    IF FOUND THEN
      UPDATE public.reading_logs
      SET window_started_at = greatest(end_at, following_update.window_started_at)
      WHERE id = following_update.id AND book_id = target_book AND user_id = owner_id;
    END IF;
  END IF;

  UPDATE public.books SET
    current_page = target_page,
    status = CASE WHEN target_page = total_pages THEN 'Finished' ELSE status END,
    date_finished = CASE WHEN target_page = total_pages
      THEN coalesce(date_finished, (now_at AT TIME ZONE reader_zone)::date) ELSE date_finished END
  WHERE id = target_book AND user_id = owner_id;

  RETURN entry;
END;
$$;

REVOKE ALL ON FUNCTION public.save_reading_activity(uuid, uuid, text, integer, integer, integer, timestamptz, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_reading_activity(uuid, uuid, text, integer, integer, integer, timestamptz, timestamptz, text)
  TO authenticated;

-- The service endpoint keeps its legacy contract and takes the same book lock.
CREATE FUNCTION public.save_legacy_reading_log(
  owner_id uuid, target_book uuid, requested_page integer, minutes integer,
  activity_at timestamptz, today date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  book public.books%ROWTYPE;
  entry public.reading_logs%ROWTYPE;
  final_page integer;
  reached_end boolean;
BEGIN
  SELECT * INTO book FROM public.books
  WHERE id = target_book AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found.' USING ERRCODE = 'P0002';
  END IF;
  IF book.status = 'Wishlist' THEN
    RAISE EXCEPTION 'Add this book to your library before logging reading.' USING ERRCODE = '22023';
  END IF;

  -- Once a book has app activity, keep future legacy page deltas compatible with its stored baselines.
  INSERT INTO public.reading_logs (book_id, user_id, current_page, reading_time_minutes, logged_at, starting_page)
  VALUES (target_book, owner_id, requested_page, minutes, coalesce(activity_at, clock_timestamp()),
    CASE WHEN EXISTS (
      SELECT 1 FROM public.reading_logs
      WHERE book_id = target_book AND user_id = owner_id AND kind <> 'legacy'
    ) THEN coalesce(book.current_page, 0) END)
  RETURNING * INTO entry;

  IF book.status = 'Paused' THEN
    UPDATE public.book_pause_periods SET resumed_at = clock_timestamp()
    WHERE book_id = target_book AND user_id = owner_id AND resumed_at IS NULL;
  END IF;

  final_page := greatest(coalesce(book.current_page, 0), requested_page);
  reached_end := book.total_pages IS NOT NULL AND book.total_pages > 0 AND final_page >= book.total_pages;
  UPDATE public.books SET
    current_page = final_page,
    status = CASE WHEN reached_end THEN 'Finished' WHEN status <> 'Finished' THEN 'Reading' ELSE status END,
    date_started = CASE WHEN status NOT IN ('Reading', 'Finished') THEN coalesce(date_started, today) ELSE date_started END,
    date_finished = CASE WHEN reached_end THEN coalesce(date_finished, today) ELSE date_finished END
  WHERE id = target_book AND user_id = owner_id RETURNING * INTO book;

  RETURN jsonb_build_object(
    'log', jsonb_build_object('id', entry.id, 'current_page', entry.current_page,
      'reading_time_minutes', entry.reading_time_minutes, 'logged_at', entry.logged_at),
    'book', jsonb_build_object('id', book.id, 'status', book.status,
      'current_page', book.current_page, 'total_pages', book.total_pages)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_legacy_reading_log(uuid, uuid, integer, integer, timestamptz, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_legacy_reading_log(uuid, uuid, integer, integer, timestamptz, date) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
