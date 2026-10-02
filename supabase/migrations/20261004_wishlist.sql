CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (btrim(title) <> ''),
  authors text[] NOT NULL DEFAULT '{}',
  genre_ids uuid[] NOT NULL DEFAULT '{}',
  genres text[] NOT NULL DEFAULT '{}',
  cover_url text,
  cover_entity_id uuid,
  total_pages integer CHECK (total_pages > 0),
  language text CHECK (language IN ('German','Spanish','English')),
  format text CHECK (format IN ('eBook','Audiobook','Paperback','Hardcover')),
  isbn text,
  publication_date date,
  description text,
  metadata_source text CHECK (metadata_source IN ('open_library','google_books')),
  metadata_source_url text,
  series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  volume_number numeric CHECK (volume_number > 0),
  price numeric(10,2) CHECK (price >= 0),
  purchase_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (book_id IS NULL OR array_length(authors, 1) IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS wishlist_items_user_id_idx ON public.wishlist_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wishlist_items_book_id_idx ON public.wishlist_items(book_id);
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY wishlist_items_select_own ON public.wishlist_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wishlist_items_insert_own ON public.wishlist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY wishlist_items_update_own ON public.wishlist_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY wishlist_items_delete_own ON public.wishlist_items FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS wishlist_items_set_updated_at ON public.wishlist_items;
CREATE TRIGGER wishlist_items_set_updated_at BEFORE UPDATE ON public.wishlist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A retry sees book_id and returns it, so a lost client response cannot duplicate a book.
CREATE OR REPLACE FUNCTION public.acquire_wishlist_item(wishlist_item_uuid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wish wishlist_items; created_book_id uuid := gen_random_uuid(); author_name text; genre_id uuid;
BEGIN
  SELECT * INTO wish FROM wishlist_items WHERE id = wishlist_item_uuid AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wishlist item was not found.'; END IF;
  IF wish.book_id IS NOT NULL THEN RETURN wish.book_id; END IF;
  INSERT INTO books (id, user_id, title, status, cover_url, total_pages, language, format, isbn, publication_date, description, metadata_source, metadata_source_url)
  VALUES (created_book_id, wish.user_id, wish.title, 'To Read', wish.cover_url, wish.total_pages, wish.language, wish.format, wish.isbn, wish.publication_date, wish.description, wish.metadata_source, wish.metadata_source_url);
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
GRANT EXECUTE ON FUNCTION public.acquire_wishlist_item(uuid) TO authenticated;

-- Keep a deleted acquired book as a pending wish unless the user explicitly opts out.
CREATE OR REPLACE FUNCTION public.return_wishlist_before_book_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE behavior text := COALESCE((SELECT reading->>'acquired_wishlist_book_deletion' FROM user_settings WHERE user_id = OLD.user_id), 'return_to_pending');
BEGIN
  IF behavior = 'remove_from_wishlist' THEN DELETE FROM wishlist_items WHERE book_id = OLD.id AND user_id = OLD.user_id;
  ELSE UPDATE wishlist_items SET book_id = NULL, title = OLD.title, cover_url = OLD.cover_url, cover_entity_id = CASE WHEN OLD.cover_url IS NULL THEN NULL ELSE OLD.id END, total_pages = OLD.total_pages, language = OLD.language, format = OLD.format, isbn = OLD.isbn, publication_date = OLD.publication_date, description = OLD.description, metadata_source = to_jsonb(OLD)->>'metadata_source', metadata_source_url = to_jsonb(OLD)->>'metadata_source_url' WHERE book_id = OLD.id AND user_id = OLD.user_id; END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS return_wishlist_before_book_delete ON public.books;
CREATE TRIGGER return_wishlist_before_book_delete BEFORE DELETE ON public.books FOR EACH ROW EXECUTE FUNCTION public.return_wishlist_before_book_delete();
NOTIFY pgrst, 'reload schema';
