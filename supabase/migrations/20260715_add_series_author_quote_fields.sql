ALTER TABLE public.series_notes
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS quote_speaker text,
  ADD COLUMN IF NOT EXISTS page_start integer,
  ADD CONSTRAINT series_notes_label_check CHECK (label IN ('quote', 'note', 'review')),
  ADD CONSTRAINT series_notes_page_start_check CHECK (page_start IS NULL OR page_start > 0);

ALTER TABLE public.author_notes
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS quote_speaker text,
  ADD COLUMN IF NOT EXISTS page_start integer,
  ADD CONSTRAINT author_notes_label_check CHECK (label IN ('quote', 'note', 'review')),
  ADD CONSTRAINT author_notes_page_start_check CHECK (page_start IS NULL OR page_start > 0);

NOTIFY pgrst, 'reload schema';
