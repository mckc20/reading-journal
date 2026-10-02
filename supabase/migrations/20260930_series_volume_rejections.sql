CREATE TABLE IF NOT EXISTS public.series_volume_rejections (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  title text NOT NULL,
  source text NOT NULL CHECK (source IN ('google_books', 'open_library')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_id, candidate_key)
);

ALTER TABLE public.series_volume_rejections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS series_volume_rejections_select_own ON public.series_volume_rejections;
CREATE POLICY series_volume_rejections_select_own
  ON public.series_volume_rejections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS series_volume_rejections_insert_own ON public.series_volume_rejections;
CREATE POLICY series_volume_rejections_insert_own
  ON public.series_volume_rejections FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.series
      WHERE series.id = series_id AND series.user_id = auth.uid()
    )
  );

REVOKE ALL ON public.series_volume_rejections FROM anon, authenticated;
GRANT SELECT, INSERT ON public.series_volume_rejections TO authenticated;
