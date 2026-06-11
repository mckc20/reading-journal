DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'belongs_to'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'source'
  ) THEN
    ALTER TABLE books RENAME COLUMN belongs_to TO source;
  END IF;
END $$;

ALTER TABLE books
  DROP CONSTRAINT IF EXISTS books_belongs_to_check,
  DROP CONSTRAINT IF EXISTS books_source_check;

UPDATE books
SET source = 'Owned'
WHERE source = 'Me';

ALTER TABLE books
  ADD CONSTRAINT books_source_check
  CHECK (source IN ('Owned','Family','Friends','Library'));

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS publication_date date,
  ADD COLUMN IF NOT EXISTS publication_date_precision text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE books
  DROP CONSTRAINT IF EXISTS books_publication_date_precision_check,
  ADD CONSTRAINT books_publication_date_precision_check
  CHECK (publication_date_precision IN ('year','month','day'));
