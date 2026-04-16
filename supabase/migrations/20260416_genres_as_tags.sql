-- Convert books.genre (text) to books.genres (text[])
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'genre'
  ) THEN
    ALTER TABLE public.books ADD COLUMN IF NOT EXISTS genres text[];

    UPDATE public.books
    SET genres = array_remove(regexp_split_to_array(genre, '\\s*,\\s*'), '')
    WHERE genre IS NOT NULL
      AND btrim(genre) <> ''
      AND (genres IS NULL OR cardinality(genres) = 0);

    ALTER TABLE public.books DROP COLUMN genre;
  END IF;
END $$;
