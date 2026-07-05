-- Create a public storage bucket for series banners and restrict writes to
-- the authenticated user's own folder.

-- Keep this migration self-contained for databases that have not applied the
-- earlier create-menu migration yet.
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

NOTIFY pgrst, 'reload schema';
