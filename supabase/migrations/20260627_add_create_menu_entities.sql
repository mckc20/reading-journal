-- Support the multi-entity add menu.

ALTER TABLE IF EXISTS public.series
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ongoing',
  ADD COLUMN IF NOT EXISTS cover_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'series_status_check'
      AND conrelid = 'public.series'::regclass
  ) THEN
    ALTER TABLE public.series
      ADD CONSTRAINT series_status_check
      CHECK (status IN ('ongoing', 'completed'));
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.genres
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE IF EXISTS public.book_notes
  ADD COLUMN IF NOT EXISTS tags text[];

NOTIFY pgrst, 'reload schema';
