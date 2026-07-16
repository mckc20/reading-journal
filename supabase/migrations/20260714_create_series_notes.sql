CREATE TABLE IF NOT EXISTS public.series_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL CHECK (length(btrim(content)) > 0),
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS series_notes_user_id_idx ON public.series_notes(user_id);
CREATE INDEX IF NOT EXISTS series_notes_series_id_idx ON public.series_notes(series_id);
CREATE INDEX IF NOT EXISTS series_notes_series_note_date_idx
  ON public.series_notes(series_id, note_date DESC, created_at DESC);

ALTER TABLE public.series_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "series_notes: owner select"
  ON public.series_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "series_notes: owner insert"
  ON public.series_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.series
      WHERE series.id = series_notes.series_id
        AND series.user_id = auth.uid()
    )
  );

CREATE POLICY "series_notes: owner update"
  ON public.series_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.series
      WHERE series.id = series_notes.series_id
        AND series.user_id = auth.uid()
    )
  );

CREATE POLICY "series_notes: owner delete"
  ON public.series_notes FOR DELETE
  USING (auth.uid() = user_id);
