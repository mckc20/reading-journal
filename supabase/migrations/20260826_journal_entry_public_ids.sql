ALTER TABLE public.book_journal ADD COLUMN IF NOT EXISTS public_id text;
ALTER TABLE public.series_journal ADD COLUMN IF NOT EXISTS public_id text;
ALTER TABLE public.author_journal ADD COLUMN IF NOT EXISTS public_id text;

CREATE OR REPLACE FUNCTION public.generate_journal_entry_public_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.book_journal WHERE public_id = candidate)
      AND NOT EXISTS (SELECT 1 FROM public.series_journal WHERE public_id = candidate)
      AND NOT EXISTS (SELECT 1 FROM public.author_journal WHERE public_id = candidate);
  END LOOP;

  RETURN candidate;
END;
$$;

UPDATE public.book_journal
SET public_id = public.generate_journal_entry_public_id()
WHERE public_id IS NULL;

UPDATE public.series_journal
SET public_id = public.generate_journal_entry_public_id()
WHERE public_id IS NULL;

UPDATE public.author_journal
SET public_id = public.generate_journal_entry_public_id()
WHERE public_id IS NULL;

ALTER TABLE public.book_journal
  ALTER COLUMN public_id SET NOT NULL,
  ALTER COLUMN public_id SET DEFAULT public.generate_journal_entry_public_id();

ALTER TABLE public.series_journal
  ALTER COLUMN public_id SET NOT NULL,
  ALTER COLUMN public_id SET DEFAULT public.generate_journal_entry_public_id();

ALTER TABLE public.author_journal
  ALTER COLUMN public_id SET NOT NULL,
  ALTER COLUMN public_id SET DEFAULT public.generate_journal_entry_public_id();

CREATE UNIQUE INDEX IF NOT EXISTS book_journal_public_id_key ON public.book_journal(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS series_journal_public_id_key ON public.series_journal(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS author_journal_public_id_key ON public.author_journal(public_id);

CREATE OR REPLACE FUNCTION public.ensure_journal_entry_public_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_id IS NULL OR btrim(NEW.public_id) = '' THEN
    NEW.public_id := public.generate_journal_entry_public_id();
  END IF;

  NEW.public_id := btrim(NEW.public_id);

  IF EXISTS (
    SELECT 1 FROM public.book_journal
    WHERE public_id = NEW.public_id
      AND (TG_TABLE_NAME <> 'book_journal' OR id <> NEW.id)
  ) OR EXISTS (
    SELECT 1 FROM public.series_journal
    WHERE public_id = NEW.public_id
      AND (TG_TABLE_NAME <> 'series_journal' OR id <> NEW.id)
  ) OR EXISTS (
    SELECT 1 FROM public.author_journal
    WHERE public_id = NEW.public_id
      AND (TG_TABLE_NAME <> 'author_journal' OR id <> NEW.id)
  ) THEN
    RAISE unique_violation USING MESSAGE = 'journal entry public_id must be unique';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS book_journal_ensure_public_id ON public.book_journal;
CREATE TRIGGER book_journal_ensure_public_id
  BEFORE INSERT OR UPDATE OF public_id ON public.book_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_journal_entry_public_id();

DROP TRIGGER IF EXISTS series_journal_ensure_public_id ON public.series_journal;
CREATE TRIGGER series_journal_ensure_public_id
  BEFORE INSERT OR UPDATE OF public_id ON public.series_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_journal_entry_public_id();

DROP TRIGGER IF EXISTS author_journal_ensure_public_id ON public.author_journal;
CREATE TRIGGER author_journal_ensure_public_id
  BEFORE INSERT OR UPDATE OF public_id ON public.author_journal
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_journal_entry_public_id();
