CREATE TABLE IF NOT EXISTS public.author_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.authors(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL CHECK (length(btrim(content)) > 0),
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS author_notes_user_id_idx ON public.author_notes(user_id);
CREATE INDEX IF NOT EXISTS author_notes_author_id_idx ON public.author_notes(author_id);
CREATE INDEX IF NOT EXISTS author_notes_author_note_date_idx
  ON public.author_notes(author_id, note_date DESC, created_at DESC);

ALTER TABLE public.author_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "author_notes: owner select"
  ON public.author_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "author_notes: owner insert"
  ON public.author_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.authors
      WHERE authors.id = author_notes.author_id
        AND authors.user_id = auth.uid()
    )
  );

CREATE POLICY "author_notes: owner update"
  ON public.author_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.authors
      WHERE authors.id = author_notes.author_id
        AND authors.user_id = auth.uid()
    )
  );

CREATE POLICY "author_notes: owner delete"
  ON public.author_notes FOR DELETE
  USING (auth.uid() = user_id);
