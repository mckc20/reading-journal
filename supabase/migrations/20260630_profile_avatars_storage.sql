-- Create a public storage bucket for profile avatars and restrict writes to
-- the authenticated user's own folder.

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS profile_avatars_public_read ON storage.objects;
CREATE POLICY profile_avatars_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS profile_avatars_insert_own ON storage.objects;
CREATE POLICY profile_avatars_insert_own
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_update_own ON storage.objects;
CREATE POLICY profile_avatars_update_own
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profile-avatars'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_delete_own ON storage.objects;
CREATE POLICY profile_avatars_delete_own
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-avatars'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );
