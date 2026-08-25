-- Remove author nationality and life-date fields from the stored author model.

ALTER TABLE authors
  DROP CONSTRAINT IF EXISTS authors_birth_date_precision_check,
  DROP CONSTRAINT IF EXISTS authors_death_date_precision_check,
  DROP CONSTRAINT IF EXISTS authors_birth_death_check;

ALTER TABLE authors
  DROP COLUMN IF EXISTS nationality,
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS birth_date_precision,
  DROP COLUMN IF EXISTS death_date,
  DROP COLUMN IF EXISTS death_date_precision,
  DROP COLUMN IF EXISTS birth_year,
  DROP COLUMN IF EXISTS death_year;
