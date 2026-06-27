-- Normalize authors into their own table and link books through book_authors.

CREATE TABLE IF NOT EXISTS authors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (btrim(name) <> ''),
  photo_url     text,
  birth_year    integer,
  death_year    integer,
  bio           text,
  is_favorite   boolean NOT NULL DEFAULT false,
  nationality   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (birth_year IS NULL OR birth_year BETWEEN 0 AND 9999),
  CHECK (death_year IS NULL OR death_year BETWEEN 0 AND 9999),
  CHECK (death_year IS NULL OR birth_year IS NULL OR death_year >= birth_year)
);

CREATE TABLE IF NOT EXISTS book_authors (
  book_id   uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  position  integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (book_id, author_id),
  UNIQUE (book_id, position)
);

CREATE UNIQUE INDEX IF NOT EXISTS authors_unique_user_name_idx
  ON authors (user_id, lower(name));
CREATE INDEX IF NOT EXISTS authors_user_id_idx      ON authors(user_id);
CREATE INDEX IF NOT EXISTS authors_is_favorite_idx  ON authors(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS book_authors_author_id_idx ON book_authors(author_id);
CREATE INDEX IF NOT EXISTS book_authors_book_id_idx   ON book_authors(book_id);

ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_authors ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS authors_set_updated_at ON authors;

CREATE TRIGGER authors_set_updated_at
  BEFORE UPDATE ON authors
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP POLICY IF EXISTS authors_select_own ON authors;
CREATE POLICY authors_select_own
  ON authors
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS authors_insert_own ON authors;
CREATE POLICY authors_insert_own
  ON authors
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS authors_update_own ON authors;
CREATE POLICY authors_update_own
  ON authors
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS authors_delete_own ON authors;
CREATE POLICY authors_delete_own
  ON authors
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS book_authors_select_own ON book_authors;
CREATE POLICY book_authors_select_own
  ON book_authors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS book_authors_insert_own ON book_authors;
CREATE POLICY book_authors_insert_own
  ON book_authors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS book_authors_update_own ON book_authors;
CREATE POLICY book_authors_update_own
  ON book_authors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS book_authors_delete_own ON book_authors;
CREATE POLICY book_authors_delete_own
  ON book_authors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_authors.book_id
        AND books.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM authors
      WHERE authors.id = book_authors.author_id
        AND authors.user_id = auth.uid()
    )
  );

DO $$
DECLARE
  legacy_author_column text;
  legacy_author_data_type text;
BEGIN
  SELECT column_name, data_type
    INTO legacy_author_column
    , legacy_author_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'books'
    AND column_name IN ('authors', 'author')
  ORDER BY CASE column_name WHEN 'authors' THEN 1 ELSE 2 END
  LIMIT 1;

  IF legacy_author_column IS NULL THEN
    RAISE NOTICE 'No legacy author column found on books; skipping author backfill.';
    RETURN;
  END IF;

  IF legacy_author_data_type = 'ARRAY' THEN
    EXECUTE format($sql$
      INSERT INTO authors (user_id, name, is_favorite, created_at)
      SELECT DISTINCT ON (books.user_id, lower(btrim(author_name)))
        books.user_id,
        btrim(author_name) AS name,
        false,
        books.created_at
      FROM books
      CROSS JOIN LATERAL unnest(COALESCE(books.%I, ARRAY[]::text[])) AS author_name
      WHERE btrim(author_name) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM authors existing
          WHERE existing.user_id = books.user_id
            AND lower(existing.name) = lower(btrim(author_name))
        )
      ORDER BY books.user_id, lower(btrim(author_name)), books.created_at;
    $sql$, legacy_author_column);

    EXECUTE format($sql$
      INSERT INTO book_authors (book_id, author_id, position)
      SELECT
        books.id,
        authors.id,
        author_names.ordinality - 1
      FROM books
      CROSS JOIN LATERAL unnest(COALESCE(books.%I, ARRAY[]::text[])) WITH ORDINALITY AS author_names(author_name, ordinality)
      JOIN authors
        ON authors.user_id = books.user_id
       AND lower(authors.name) = lower(btrim(author_names.author_name))
      WHERE btrim(author_names.author_name) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM book_authors existing
          WHERE existing.book_id = books.id
            AND existing.author_id = authors.id
        );
    $sql$, legacy_author_column);
  ELSE
    EXECUTE format($sql$
      INSERT INTO authors (user_id, name, is_favorite, created_at)
      SELECT DISTINCT ON (books.user_id, lower(btrim(author_name)))
        books.user_id,
        btrim(author_name) AS name,
        false,
        books.created_at
      FROM books
      CROSS JOIN LATERAL (
        SELECT books.%I AS author_name
      ) legacy
      WHERE btrim(author_name) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM authors existing
          WHERE existing.user_id = books.user_id
            AND lower(existing.name) = lower(btrim(author_name))
        )
      ORDER BY books.user_id, lower(btrim(author_name)), books.created_at;
    $sql$, legacy_author_column);

    EXECUTE format($sql$
      INSERT INTO book_authors (book_id, author_id, position)
      SELECT
        books.id,
        authors.id,
        0
      FROM books
      JOIN authors
        ON authors.user_id = books.user_id
       AND lower(authors.name) = lower(btrim(books.%I))
      WHERE btrim(books.%I) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM book_authors existing
          WHERE existing.book_id = books.id
            AND existing.author_id = authors.id
        );
    $sql$, legacy_author_column, legacy_author_column);
  END IF;
END $$;

ALTER TABLE books DROP COLUMN IF EXISTS authors;
ALTER TABLE books DROP COLUMN IF EXISTS author;
