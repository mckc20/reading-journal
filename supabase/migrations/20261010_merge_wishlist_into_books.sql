-- Back up first. Pause app writes and deploy the matching frontend with this migration.
-- Everything, including removal of legacy data, rolls back on any validation failure.
BEGIN;
LOCK TABLE public.books IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS metadata_source text
  CHECK (metadata_source IN ('open_library', 'google_books'));
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS metadata_source_url text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS price numeric(10,2) CHECK (price >= 0);
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS purchase_url text;
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_status_check;
ALTER TABLE public.books ADD CONSTRAINT books_status_check
  CHECK (status IN ('Wishlist','To Read','Up Next','Reading','Paused','Finished','DNF'));

DO $$
DECLARE
  wish jsonb; wish_id uuid; owner_id uuid; linked_id uuid;
  author_row record; genre_id uuid; migrated_count integer := 0; expected_count integer;
BEGIN
  IF to_regclass('public.wishlist_items') IS NULL THEN RETURN; END IF;
  LOCK TABLE public.wishlist_items IN ACCESS EXCLUSIVE MODE;
  SELECT count(*) INTO expected_count FROM public.wishlist_items WHERE book_id IS NULL;

  FOR wish IN SELECT to_jsonb(w) FROM public.wishlist_items w ORDER BY created_at, id LOOP
    wish_id := (wish->>'id')::uuid;
    owner_id := (wish->>'user_id')::uuid;
    linked_id := (wish->>'book_id')::uuid;
    IF linked_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.books WHERE id = linked_id AND user_id = owner_id AND status <> 'Wishlist') THEN
        RAISE EXCEPTION 'Invalid acquired wishlist link: %', wish_id;
      END IF;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.books WHERE id = wish_id) THEN
      RAISE EXCEPTION 'Wishlist/book ID collision: %', wish_id;
    END IF;
    IF wish->>'series_id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.series WHERE id = (wish->>'series_id')::uuid AND user_id = owner_id
    ) THEN RAISE EXCEPTION 'Invalid wishlist series ownership: %', wish_id; END IF;

    INSERT INTO public.books (
      id, user_id, title, status, genres, cover_url, total_pages, language, format, isbn,
      publication_date, description, metadata_source, metadata_source_url,
      series_id, volume_number, price, purchase_url, created_at
    ) VALUES (
      wish_id, owner_id, wish->>'title', 'Wishlist',
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(wish->'genres', '[]'::jsonb))),
      wish->>'cover_url', (wish->>'total_pages')::integer, wish->>'language', wish->>'format', wish->>'isbn',
      (wish->>'publication_date')::date, wish->>'description', wish->>'metadata_source', wish->>'metadata_source_url',
      (wish->>'series_id')::uuid, (wish->>'volume_number')::numeric,
      (wish->>'price')::numeric, wish->>'purchase_url', (wish->>'created_at')::timestamptz
    );

    -- Collapse repeated author names without losing their original order.
    FOR author_row IN
      SELECT lower(btrim(value)) AS key, (array_agg(btrim(value) ORDER BY ord))[1] AS name, min(ord)::integer - 1 AS position
      FROM jsonb_array_elements_text(COALESCE(wish->'authors', '[]'::jsonb)) WITH ORDINALITY a(value, ord)
      WHERE btrim(value) <> '' GROUP BY lower(btrim(value)) ORDER BY min(ord)
    LOOP
      INSERT INTO public.authors (user_id, name) VALUES (owner_id, author_row.name)
      ON CONFLICT (user_id, lower(name)) DO NOTHING;
      INSERT INTO public.book_authors (book_id, author_id, position)
      SELECT wish_id, id, author_row.position FROM public.authors
      WHERE user_id = owner_id AND lower(name) = author_row.key;
    END LOOP;
    FOR genre_id IN SELECT jsonb_array_elements_text(COALESCE(wish->'genre_ids', '[]'::jsonb))::uuid LOOP
      IF NOT EXISTS (SELECT 1 FROM public.genres WHERE id = genre_id AND (is_system OR user_id = owner_id)) THEN
        RAISE EXCEPTION 'Invalid wishlist genre ownership: %', wish_id;
      END IF;
      INSERT INTO public.book_genres (book_id, genre_id) VALUES (wish_id, genre_id) ON CONFLICT DO NOTHING;
    END LOOP;
    migrated_count := migrated_count + 1;
  END LOOP;

  -- Most recent non-empty purchase values win; never replace existing book values.
  UPDATE public.books b SET
    price = COALESCE(b.price, (
      SELECT (to_jsonb(w)->>'price')::numeric FROM public.wishlist_items w
      WHERE w.book_id = b.id AND w.user_id = b.user_id AND to_jsonb(w)->>'price' IS NOT NULL
      ORDER BY w.updated_at DESC, w.id DESC LIMIT 1
    )),
    purchase_url = COALESCE(NULLIF(b.purchase_url, ''), (
      SELECT NULLIF(to_jsonb(w)->>'purchase_url', '') FROM public.wishlist_items w
      WHERE w.book_id = b.id AND w.user_id = b.user_id AND NULLIF(to_jsonb(w)->>'purchase_url', '') IS NOT NULL
      ORDER BY w.updated_at DESC, w.id DESC LIMIT 1
    ))
  WHERE EXISTS (SELECT 1 FROM public.wishlist_items w WHERE w.book_id = b.id AND w.user_id = b.user_id);

  IF migrated_count <> expected_count OR EXISTS (
    SELECT 1 FROM public.wishlist_items w LEFT JOIN public.books b ON b.id = w.id AND b.user_id = w.user_id
    WHERE w.book_id IS NULL AND (b.id IS NULL OR b.status <> 'Wishlist')
  ) THEN RAISE EXCEPTION 'Wishlist migration validation failed.'; END IF;
  RAISE NOTICE 'Migrated % pending wishes; acquired books retained.', migrated_count;
END;
$$;

DROP TRIGGER IF EXISTS return_wishlist_before_book_delete ON public.books;
DROP FUNCTION IF EXISTS public.return_wishlist_before_book_delete();
DROP FUNCTION IF EXISTS public.acquire_wishlist_item(uuid);
-- No CASCADE: unexpected dependencies must abort rather than silently disappear.
DROP TABLE IF EXISTS public.wishlist_items;
DROP FUNCTION IF EXISTS public.cleanup_wishlist_placeholder_series();

UPDATE public.series s SET is_wishlist_only = false
WHERE is_wishlist_only AND EXISTS (SELECT 1 FROM public.books b WHERE b.series_id = s.id AND b.user_id = s.user_id AND b.status <> 'Wishlist');
UPDATE public.user_settings SET reading = reading - 'acquired_wishlist_book_deletion';
-- Remove the obsolete option from future rows as well, preserving other defaults.
DO $$
DECLARE stored_default text;
BEGIN
  SELECT pg_get_expr(d.adbin, d.adrelid) INTO stored_default
  FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  WHERE d.adrelid = 'public.user_settings'::regclass AND a.attname = 'reading';
  IF stored_default LIKE '%acquired_wishlist_book_deletion%' THEN
    EXECUTE format('ALTER TABLE public.user_settings ALTER COLUMN reading SET DEFAULT (%s) - %L', stored_default, 'acquired_wishlist_book_deletion');
  END IF;
END;
$$;
-- Keep series visibility and pause state consistent for every writer (UI and API).
CREATE OR REPLACE FUNCTION public.sync_book_wishlist_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Wishlist' AND TG_OP = 'UPDATE' AND OLD.status <> 'Wishlist' THEN
    UPDATE public.book_pause_periods SET resumed_at = now()
    WHERE book_id = NEW.id AND user_id = NEW.user_id AND resumed_at IS NULL;
  END IF;
  IF NEW.series_id IS NOT NULL AND NEW.status <> 'Wishlist' THEN
    UPDATE public.series SET is_wishlist_only = false
    WHERE id = NEW.series_id AND user_id = NEW.user_id AND is_wishlist_only;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_book_wishlist_state ON public.books;
CREATE TRIGGER sync_book_wishlist_state AFTER INSERT OR UPDATE OF status, series_id ON public.books
FOR EACH ROW EXECUTE FUNCTION public.sync_book_wishlist_state();

CREATE OR REPLACE FUNCTION public.cleanup_empty_wishlist_series()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.series_id IS NOT DISTINCT FROM NEW.series_id THEN
    RETURN NEW;
  END IF;
  IF OLD.series_id IS NOT NULL THEN
    DELETE FROM public.series WHERE id = OLD.series_id AND user_id = OLD.user_id
      AND is_wishlist_only AND NOT EXISTS (SELECT 1 FROM public.books WHERE series_id = OLD.series_id);
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS cleanup_empty_wishlist_series ON public.books;
CREATE TRIGGER cleanup_empty_wishlist_series AFTER DELETE OR UPDATE OF series_id ON public.books
FOR EACH ROW EXECUTE FUNCTION public.cleanup_empty_wishlist_series();

-- Preserve existing logs, but do not allow new reading sessions on unacquired books.
CREATE OR REPLACE FUNCTION public.reject_wishlist_reading_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE book_status text; book_owner uuid;
BEGIN
  SELECT status, user_id INTO book_status, book_owner FROM public.books WHERE id = NEW.book_id FOR SHARE;
  IF book_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Book not found for this user.';
  END IF;
  IF book_status = 'Wishlist' THEN
    RAISE EXCEPTION 'Add this book to your library before logging reading.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reject_wishlist_reading_log ON public.reading_logs;
CREATE TRIGGER reject_wishlist_reading_log BEFORE INSERT ON public.reading_logs
FOR EACH ROW EXECUTE FUNCTION public.reject_wishlist_reading_log();
REVOKE ALL ON FUNCTION public.sync_book_wishlist_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_empty_wishlist_series() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_wishlist_reading_log() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
COMMIT;
