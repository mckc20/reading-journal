-- Replace author year-only fields with partial dates while keeping the old
-- values available as backfilled year precision dates.

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS birth_date_precision text,
  ADD COLUMN IF NOT EXISTS death_date date,
  ADD COLUMN IF NOT EXISTS death_date_precision text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'authors'
      AND column_name = 'birth_year'
  ) THEN
    EXECUTE $sql$
      UPDATE authors
      SET
        birth_date = COALESCE(birth_date, make_date(birth_year, 1, 1)),
        birth_date_precision = COALESCE(birth_date_precision, 'year')
      WHERE birth_year IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'authors'
      AND column_name = 'death_year'
  ) THEN
    EXECUTE $sql$
      UPDATE authors
      SET
        death_date = COALESCE(death_date, make_date(death_year, 1, 1)),
        death_date_precision = COALESCE(death_date_precision, 'year')
      WHERE death_year IS NOT NULL
    $sql$;
  END IF;
END $$;

ALTER TABLE authors
  DROP CONSTRAINT IF EXISTS authors_birth_date_precision_check,
  DROP CONSTRAINT IF EXISTS authors_death_date_precision_check,
  DROP CONSTRAINT IF EXISTS authors_birth_death_check;

ALTER TABLE authors
  ADD CONSTRAINT authors_birth_date_precision_check
    CHECK (birth_date_precision IN ('year', 'month', 'day')),
  ADD CONSTRAINT authors_death_date_precision_check
    CHECK (death_date_precision IN ('year', 'month', 'day')),
  ADD CONSTRAINT authors_birth_death_check
    CHECK (death_date IS NULL OR birth_date IS NULL OR death_date >= birth_date);

ALTER TABLE authors
  DROP COLUMN IF EXISTS birth_year,
  DROP COLUMN IF EXISTS death_year;
