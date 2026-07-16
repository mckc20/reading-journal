ALTER TABLE public.series_notes
  ADD COLUMN IF NOT EXISTS tags text[];

ALTER TABLE public.author_notes
  ADD COLUMN IF NOT EXISTS tags text[];

CREATE TABLE IF NOT EXISTS public.journal_entry_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('Book','Series','Author')),
  entity_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('book_note','series_note','author_note','generated_book_event')),
  source_id text NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id, source, source_id)
);

CREATE INDEX IF NOT EXISTS journal_entry_visibility_entity_idx
  ON public.journal_entry_visibility(user_id, entity_type, entity_id);

ALTER TABLE public.journal_entry_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entry_visibility: owner select"
  ON public.journal_entry_visibility FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "journal_entry_visibility: owner insert"
  ON public.journal_entry_visibility FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_entry_visibility: owner delete"
  ON public.journal_entry_visibility FOR DELETE
  USING (auth.uid() = user_id);
