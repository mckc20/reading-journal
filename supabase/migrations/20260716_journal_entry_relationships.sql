ALTER TABLE IF EXISTS public.book_notes RENAME TO book_journal;
ALTER TABLE IF EXISTS public.series_notes RENAME TO series_journal;
ALTER TABLE IF EXISTS public.author_notes RENAME TO author_journal;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'book_journal' AND column_name = 'note_date'
  ) THEN
    ALTER TABLE public.book_journal RENAME COLUMN note_date TO entry_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'series_journal' AND column_name = 'note_date'
  ) THEN
    ALTER TABLE public.series_journal RENAME COLUMN note_date TO entry_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'author_journal' AND column_name = 'note_date'
  ) THEN
    ALTER TABLE public.author_journal RENAME COLUMN note_date TO entry_date;
  END IF;
END $$;

ALTER TABLE public.book_journal
  ADD COLUMN IF NOT EXISTS parent_entry_id uuid,
  DROP CONSTRAINT IF EXISTS book_journal_parent_entry_id_fkey,
  ADD CONSTRAINT book_journal_parent_entry_id_fkey
    FOREIGN KEY (parent_entry_id) REFERENCES public.book_journal(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS book_journal_parent_not_self,
  ADD CONSTRAINT book_journal_parent_not_self
    CHECK (parent_entry_id IS NULL OR parent_entry_id <> id);

ALTER TABLE public.series_journal
  ADD COLUMN IF NOT EXISTS parent_entry_id uuid,
  DROP CONSTRAINT IF EXISTS series_journal_parent_entry_id_fkey,
  ADD CONSTRAINT series_journal_parent_entry_id_fkey
    FOREIGN KEY (parent_entry_id) REFERENCES public.series_journal(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS series_journal_parent_not_self,
  ADD CONSTRAINT series_journal_parent_not_self
    CHECK (parent_entry_id IS NULL OR parent_entry_id <> id);

ALTER TABLE public.author_journal
  ADD COLUMN IF NOT EXISTS parent_entry_id uuid,
  DROP CONSTRAINT IF EXISTS author_journal_parent_entry_id_fkey,
  ADD CONSTRAINT author_journal_parent_entry_id_fkey
    FOREIGN KEY (parent_entry_id) REFERENCES public.author_journal(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS author_journal_parent_not_self,
  ADD CONSTRAINT author_journal_parent_not_self
    CHECK (parent_entry_id IS NULL OR parent_entry_id <> id);

CREATE OR REPLACE FUNCTION public.inherit_book_journal_reply_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_record public.book_journal%ROWTYPE;
BEGIN
  IF NEW.parent_entry_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_record
  FROM public.book_journal
  WHERE id = NEW.parent_entry_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.user_id := parent_record.user_id;
  NEW.book_id := parent_record.book_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.inherit_series_journal_reply_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_record public.series_journal%ROWTYPE;
BEGIN
  IF NEW.parent_entry_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_record
  FROM public.series_journal
  WHERE id = NEW.parent_entry_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.user_id := parent_record.user_id;
  NEW.series_id := parent_record.series_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.inherit_author_journal_reply_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_record public.author_journal%ROWTYPE;
BEGIN
  IF NEW.parent_entry_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_record
  FROM public.author_journal
  WHERE id = NEW.parent_entry_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.user_id := parent_record.user_id;
  NEW.author_id := parent_record.author_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS book_journal_inherit_reply_fields ON public.book_journal;
CREATE TRIGGER book_journal_inherit_reply_fields
  BEFORE INSERT OR UPDATE OF parent_entry_id ON public.book_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.inherit_book_journal_reply_fields();

DROP TRIGGER IF EXISTS series_journal_inherit_reply_fields ON public.series_journal;
CREATE TRIGGER series_journal_inherit_reply_fields
  BEFORE INSERT OR UPDATE OF parent_entry_id ON public.series_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.inherit_series_journal_reply_fields();

DROP TRIGGER IF EXISTS author_journal_inherit_reply_fields ON public.author_journal;
CREATE TRIGGER author_journal_inherit_reply_fields
  BEFORE INSERT OR UPDATE OF parent_entry_id ON public.author_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.inherit_author_journal_reply_fields();

CREATE TABLE IF NOT EXISTS public.book_journal_entry_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_a_id uuid NOT NULL REFERENCES public.book_journal(id) ON DELETE CASCADE,
  entry_b_id uuid NOT NULL REFERENCES public.book_journal(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (entry_a_id <> entry_b_id),
  UNIQUE (entry_a_id, entry_b_id)
);

CREATE TABLE IF NOT EXISTS public.series_journal_entry_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_a_id uuid NOT NULL REFERENCES public.series_journal(id) ON DELETE CASCADE,
  entry_b_id uuid NOT NULL REFERENCES public.series_journal(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (entry_a_id <> entry_b_id),
  UNIQUE (entry_a_id, entry_b_id)
);

CREATE TABLE IF NOT EXISTS public.author_journal_entry_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_a_id uuid NOT NULL REFERENCES public.author_journal(id) ON DELETE CASCADE,
  entry_b_id uuid NOT NULL REFERENCES public.author_journal(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (entry_a_id <> entry_b_id),
  UNIQUE (entry_a_id, entry_b_id)
);

CREATE INDEX IF NOT EXISTS book_journal_parent_entry_id_idx ON public.book_journal(parent_entry_id);
CREATE INDEX IF NOT EXISTS series_journal_parent_entry_id_idx ON public.series_journal(parent_entry_id);
CREATE INDEX IF NOT EXISTS author_journal_parent_entry_id_idx ON public.author_journal(parent_entry_id);
CREATE INDEX IF NOT EXISTS book_journal_entry_links_entry_b_id_idx ON public.book_journal_entry_links(entry_b_id);
CREATE INDEX IF NOT EXISTS series_journal_entry_links_entry_b_id_idx ON public.series_journal_entry_links(entry_b_id);
CREATE INDEX IF NOT EXISTS author_journal_entry_links_entry_b_id_idx ON public.author_journal_entry_links(entry_b_id);

ALTER TABLE public.book_journal_entry_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_journal_entry_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_journal_entry_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "book_journal_entry_links: owner select" ON public.book_journal_entry_links;
CREATE POLICY "book_journal_entry_links: owner select"
  ON public.book_journal_entry_links FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.book_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.book_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "book_journal_entry_links: owner insert" ON public.book_journal_entry_links;
CREATE POLICY "book_journal_entry_links: owner insert"
  ON public.book_journal_entry_links FOR INSERT
  WITH CHECK (
    entry_a_id < entry_b_id
    AND EXISTS (SELECT 1 FROM public.book_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.book_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "book_journal_entry_links: owner delete" ON public.book_journal_entry_links;
CREATE POLICY "book_journal_entry_links: owner delete"
  ON public.book_journal_entry_links FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.book_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.book_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "series_journal_entry_links: owner select" ON public.series_journal_entry_links;
CREATE POLICY "series_journal_entry_links: owner select"
  ON public.series_journal_entry_links FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.series_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.series_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "series_journal_entry_links: owner insert" ON public.series_journal_entry_links;
CREATE POLICY "series_journal_entry_links: owner insert"
  ON public.series_journal_entry_links FOR INSERT
  WITH CHECK (
    entry_a_id < entry_b_id
    AND EXISTS (SELECT 1 FROM public.series_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.series_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "series_journal_entry_links: owner delete" ON public.series_journal_entry_links;
CREATE POLICY "series_journal_entry_links: owner delete"
  ON public.series_journal_entry_links FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.series_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.series_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "author_journal_entry_links: owner select" ON public.author_journal_entry_links;
CREATE POLICY "author_journal_entry_links: owner select"
  ON public.author_journal_entry_links FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.author_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.author_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "author_journal_entry_links: owner insert" ON public.author_journal_entry_links;
CREATE POLICY "author_journal_entry_links: owner insert"
  ON public.author_journal_entry_links FOR INSERT
  WITH CHECK (
    entry_a_id < entry_b_id
    AND EXISTS (SELECT 1 FROM public.author_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.author_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "author_journal_entry_links: owner delete" ON public.author_journal_entry_links;
CREATE POLICY "author_journal_entry_links: owner delete"
  ON public.author_journal_entry_links FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.author_journal WHERE id = entry_a_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.author_journal WHERE id = entry_b_id AND user_id = auth.uid())
  );
