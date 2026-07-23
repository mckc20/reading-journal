-- Private journal image attachments.

INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-media', 'journal-media', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

CREATE TABLE IF NOT EXISTS public.media_attachments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path      text NOT NULL,
  thumbnail_path text,
  file_name      text NOT NULL,
  file_type      text NOT NULL CHECK (file_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size      integer NOT NULL CHECK (file_size > 0),
  width          integer CHECK (width IS NULL OR width > 0),
  height         integer CHECK (height IS NULL OR height > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_path)
);

CREATE TABLE IF NOT EXISTS public.journal_entry_media (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_source text NOT NULL CHECK (journal_entry_source IN ('book_note', 'series_note', 'author_note')),
  journal_entry_id    uuid NOT NULL,
  media_attachment_id uuid NOT NULL REFERENCES public.media_attachments(id) ON DELETE CASCADE,
  position            integer NOT NULL DEFAULT 1 CHECK (position >= 0),
  caption             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_entry_source, journal_entry_id, media_attachment_id)
);

CREATE INDEX IF NOT EXISTS media_attachments_user_id_idx
  ON public.media_attachments(user_id);

CREATE INDEX IF NOT EXISTS journal_entry_media_entry_idx
  ON public.journal_entry_media(journal_entry_source, journal_entry_id, position, created_at);

CREATE INDEX IF NOT EXISTS journal_entry_media_media_attachment_id_idx
  ON public.journal_entry_media(media_attachment_id);

ALTER TABLE public.media_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_media ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_owns_journal_entry(
  entry_source text,
  entry_id uuid,
  owner_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE entry_source
    WHEN 'book_note' THEN EXISTS (
      SELECT 1 FROM public.book_journal
      WHERE id = entry_id AND user_id = owner_id
    )
    WHEN 'series_note' THEN EXISTS (
      SELECT 1 FROM public.series_journal
      WHERE id = entry_id AND user_id = owner_id
    )
    WHEN 'author_note' THEN EXISTS (
      SELECT 1 FROM public.author_journal
      WHERE id = entry_id AND user_id = owner_id
    )
    ELSE false
  END
$$;

CREATE POLICY "media_attachments: owner select"
  ON public.media_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "media_attachments: owner insert"
  ON public.media_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "media_attachments: owner update"
  ON public.media_attachments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "media_attachments: owner delete"
  ON public.media_attachments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "journal_entry_media: owner select"
  ON public.journal_entry_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND public.user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  );

CREATE POLICY "journal_entry_media: owner insert"
  ON public.journal_entry_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND public.user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  );

CREATE POLICY "journal_entry_media: owner update"
  ON public.journal_entry_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND public.user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND public.user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  );

CREATE POLICY "journal_entry_media: owner delete"
  ON public.journal_entry_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.media_attachments
      WHERE media_attachments.id = journal_entry_media.media_attachment_id
        AND media_attachments.user_id = auth.uid()
    )
    AND public.user_owns_journal_entry(journal_entry_source, journal_entry_id, auth.uid())
  );

DROP POLICY IF EXISTS journal_media_select_own ON storage.objects;
CREATE POLICY journal_media_select_own
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS journal_media_insert_own ON storage.objects;
CREATE POLICY journal_media_insert_own
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS journal_media_update_own ON storage.objects;
CREATE POLICY journal_media_update_own
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS journal_media_delete_own ON storage.objects;
CREATE POLICY journal_media_delete_own
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'journal-media'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP TRIGGER IF EXISTS media_attachments_set_updated_at ON public.media_attachments;
CREATE TRIGGER media_attachments_set_updated_at
  BEFORE UPDATE ON public.media_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.delete_journal_entry_media_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  source_name text;
BEGIN
  source_name := TG_ARGV[0];
  DELETE FROM public.journal_entry_media
  WHERE journal_entry_source = source_name
    AND journal_entry_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS book_journal_delete_media_links ON public.book_journal;
CREATE TRIGGER book_journal_delete_media_links
  BEFORE DELETE ON public.book_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_journal_entry_media_links('book_note');

DROP TRIGGER IF EXISTS series_journal_delete_media_links ON public.series_journal;
CREATE TRIGGER series_journal_delete_media_links
  BEFORE DELETE ON public.series_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_journal_entry_media_links('series_note');

DROP TRIGGER IF EXISTS author_journal_delete_media_links ON public.author_journal;
CREATE TRIGGER author_journal_delete_media_links
  BEFORE DELETE ON public.author_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_journal_entry_media_links('author_note');

NOTIFY pgrst, 'reload schema';
