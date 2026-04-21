ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS authors text[];

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'author'
  ) THEN
    UPDATE public.books
    SET authors = ARRAY[btrim(author)]
    WHERE (authors IS NULL OR cardinality(authors) = 0)
      AND author IS NOT NULL
      AND btrim(author) <> '';
  END IF;
END $$;

UPDATE public.books
SET authors = ARRAY['Unknown']
WHERE authors IS NULL OR cardinality(authors) = 0;

ALTER TABLE public.books
ALTER COLUMN authors SET NOT NULL;

ALTER TABLE public.books
DROP CONSTRAINT IF EXISTS books_authors_non_empty;

ALTER TABLE public.books
ADD CONSTRAINT books_authors_non_empty CHECK (cardinality(authors) > 0);

ALTER TABLE public.books
DROP COLUMN IF EXISTS author;
