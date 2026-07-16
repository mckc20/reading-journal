ALTER TABLE public.series_notes
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

ALTER TABLE public.author_notes
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
