ALTER TABLE books
  DROP COLUMN IF EXISTS publisher,
  DROP COLUMN IF EXISTS publication_date_precision;
