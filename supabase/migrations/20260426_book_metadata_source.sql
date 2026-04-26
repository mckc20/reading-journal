ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS metadata_source text,
ADD COLUMN IF NOT EXISTS metadata_source_url text;

ALTER TABLE public.books
DROP CONSTRAINT IF EXISTS books_metadata_source_check;

ALTER TABLE public.books
ADD CONSTRAINT books_metadata_source_check
CHECK (metadata_source IS NULL OR metadata_source IN ('open_library', 'google_books'));
