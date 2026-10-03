-- Keep wishlist acquisition compatible with databases created before the
-- optional book metadata-source columns were added.
CREATE OR REPLACE FUNCTION public.acquire_wishlist_item(wishlist_item_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wish wishlist_items;
  created_book_id uuid := gen_random_uuid();
  author_name text;
  genre_id uuid;
  book_columns text := 'id, user_id, title, status, cover_url, total_pages, language, format, isbn, publication_date, description';
  book_values text;
BEGIN
  SELECT * INTO wish
  FROM wishlist_items
  WHERE id = wishlist_item_uuid AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wishlist item was not found.';
  END IF;

  IF wish.book_id IS NOT NULL THEN
    RETURN wish.book_id;
  END IF;

  book_values := format(
    '%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L',
    created_book_id,
    wish.user_id,
    wish.title,
    'To Read',
    wish.cover_url,
    wish.total_pages,
    wish.language,
    wish.format,
    wish.isbn,
    wish.publication_date,
    wish.description
  );

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'metadata_source'
  ) THEN
    book_columns := book_columns || ', metadata_source, metadata_source_url';
    book_values := book_values || format(', %L, %L', wish.metadata_source, wish.metadata_source_url);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'series_id'
  ) THEN
    book_columns := book_columns || ', series_id, volume_number';
    book_values := book_values || format(', %L, %L', wish.series_id, wish.volume_number);
  END IF;

  EXECUTE format('INSERT INTO books (%s) VALUES (%s)', book_columns, book_values);

  FOREACH author_name IN ARRAY wish.authors LOOP
    INSERT INTO authors (id, user_id, name)
    VALUES (gen_random_uuid(), wish.user_id, btrim(author_name))
    ON CONFLICT (user_id, lower(name)) DO NOTHING;

    INSERT INTO book_authors (book_id, author_id, position)
      SELECT created_book_id, id, array_position(wish.authors, author_name) - 1
      FROM authors
      WHERE user_id = wish.user_id AND lower(name) = lower(btrim(author_name))
      ON CONFLICT DO NOTHING;
  END LOOP;

  FOREACH genre_id IN ARRAY wish.genre_ids LOOP
    INSERT INTO book_genres (book_id, genre_id)
    VALUES (created_book_id, genre_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE wishlist_items
  SET book_id = created_book_id
  WHERE id = wish.id;

  IF wish.series_id IS NOT NULL THEN
    UPDATE series
    SET is_wishlist_only = false
    WHERE id = wish.series_id AND user_id = wish.user_id;
  END IF;

  RETURN created_book_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_wishlist_item(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
