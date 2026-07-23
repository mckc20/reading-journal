DO $$
BEGIN
  IF to_regclass('public.book_journal') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'book_journal' AND column_name = 'attribution'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'book_journal' AND column_name = 'quote_speaker'
    ) THEN
      UPDATE public.book_journal
      SET attribution = COALESCE(NULLIF(btrim(attribution), ''), NULLIF(btrim(quote_speaker), ''));
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'book_journal' AND column_name = 'quote_speaker'
    ) THEN
      ALTER TABLE public.book_journal RENAME COLUMN quote_speaker TO attribution;
    END IF;

    ALTER TABLE public.book_journal ADD COLUMN IF NOT EXISTS attribution text;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'book_journal' AND column_name = 'title'
    ) THEN
      UPDATE public.book_journal
      SET content = '## ' || btrim(title) || E'\n\n' || content
      WHERE COALESCE(label, 'note') <> 'quote'
        AND NULLIF(btrim(title), '') IS NOT NULL;

      ALTER TABLE public.book_journal DROP COLUMN IF EXISTS title;
    END IF;

    ALTER TABLE public.book_journal DROP COLUMN IF EXISTS quote_speaker;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.series_journal') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'series_journal' AND column_name = 'attribution'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'series_journal' AND column_name = 'quote_speaker'
    ) THEN
      UPDATE public.series_journal
      SET attribution = COALESCE(NULLIF(btrim(attribution), ''), NULLIF(btrim(quote_speaker), ''));
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'series_journal' AND column_name = 'quote_speaker'
    ) THEN
      ALTER TABLE public.series_journal RENAME COLUMN quote_speaker TO attribution;
    END IF;

    ALTER TABLE public.series_journal ADD COLUMN IF NOT EXISTS attribution text;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'series_journal' AND column_name = 'title'
    ) THEN
      UPDATE public.series_journal
      SET content = '## ' || btrim(title) || E'\n\n' || content
      WHERE COALESCE(label, 'note') <> 'quote'
        AND NULLIF(btrim(title), '') IS NOT NULL;

      ALTER TABLE public.series_journal DROP COLUMN IF EXISTS title;
    END IF;

    ALTER TABLE public.series_journal DROP COLUMN IF EXISTS quote_speaker;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.author_journal') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'author_journal' AND column_name = 'attribution'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'author_journal' AND column_name = 'quote_speaker'
    ) THEN
      UPDATE public.author_journal
      SET attribution = COALESCE(NULLIF(btrim(attribution), ''), NULLIF(btrim(quote_speaker), ''));
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'author_journal' AND column_name = 'quote_speaker'
    ) THEN
      ALTER TABLE public.author_journal RENAME COLUMN quote_speaker TO attribution;
    END IF;

    ALTER TABLE public.author_journal ADD COLUMN IF NOT EXISTS attribution text;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'author_journal' AND column_name = 'title'
    ) THEN
      UPDATE public.author_journal
      SET content = '## ' || btrim(title) || E'\n\n' || content
      WHERE COALESCE(label, 'note') <> 'quote'
        AND NULLIF(btrim(title), '') IS NOT NULL;

      ALTER TABLE public.author_journal DROP COLUMN IF EXISTS title;
    END IF;

    ALTER TABLE public.author_journal DROP COLUMN IF EXISTS quote_speaker;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
