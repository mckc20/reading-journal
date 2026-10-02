ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS volume_number numeric CHECK (volume_number > 0),
  ADD COLUMN IF NOT EXISTS price numeric(10,2) CHECK (price >= 0),
  ADD COLUMN IF NOT EXISTS purchase_url text;

CREATE OR REPLACE FUNCTION public.acquire_wishlist_item(wishlist_item_uuid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wish wishlist_items; created_book_id uuid := gen_random_uuid(); author_name text; genre_id uuid;
BEGIN
  SELECT * INTO wish FROM wishlist_items WHERE id = wishlist_item_uuid AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wishlist item was not found.'; END IF;
  IF wish.book_id IS NOT NULL THEN RETURN wish.book_id; END IF;
  INSERT INTO books (id, user_id, title, status, cover_url, total_pages, language, format, isbn, publication_date, description, metadata_source, metadata_source_url, series_id, volume_number)
  VALUES (created_book_id, wish.user_id, wish.title, 'To Read', wish.cover_url, wish.total_pages, wish.language, wish.format, wish.isbn, wish.publication_date, wish.description, wish.metadata_source, wish.metadata_source_url, wish.series_id, wish.volume_number);
  FOREACH author_name IN ARRAY wish.authors LOOP
    INSERT INTO authors (id, user_id, name) VALUES (gen_random_uuid(), wish.user_id, btrim(author_name)) ON CONFLICT (user_id, lower(name)) DO NOTHING;
    INSERT INTO book_authors (book_id, author_id, position)
      SELECT created_book_id, id, array_position(wish.authors, author_name) - 1 FROM authors WHERE user_id = wish.user_id AND lower(name) = lower(btrim(author_name))
      ON CONFLICT DO NOTHING;
  END LOOP;
  FOREACH genre_id IN ARRAY wish.genre_ids LOOP
    INSERT INTO book_genres (book_id, genre_id) VALUES (created_book_id, genre_id) ON CONFLICT DO NOTHING;
  END LOOP;
  UPDATE wishlist_items SET book_id = created_book_id WHERE id = wish.id;
  RETURN created_book_id;
END; $$;

NOTIFY pgrst, 'reload schema';
