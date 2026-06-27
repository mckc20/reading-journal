-- Create a public storage bucket for author photos and restrict writes to the
-- authenticated user's own folder.

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
