-- Remove the deprecated author website column.

ALTER TABLE authors
  DROP COLUMN IF EXISTS website;
