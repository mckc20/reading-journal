-- Remove user-managed genres.
-- Martina's existing custom genres become shared system genres. Other users'
-- existing custom genres stay owner-visible/read-only so their libraries keep working.

DO $$
DECLARE
  martina_user_id uuid := '5415421d-0a6e-447e-a090-8d11e705418b'::uuid;
  genre_record record;
  target_parent_id uuid;
  existing_system_id uuid;
  promoted_count integer;
BEGIN
  CREATE TEMP TABLE genre_promotion_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  LOOP
    promoted_count := 0;

    FOR genre_record IN
      SELECT genre.*
      FROM public.genres AS genre
      WHERE genre.user_id = martina_user_id
        AND genre.is_system = false
        AND NOT EXISTS (
          SELECT 1
          FROM genre_promotion_map AS mapped
          WHERE mapped.old_id = genre.id
        )
        AND (
          genre.parent_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.genres AS parent
            WHERE parent.id = genre.parent_id
              AND parent.is_system = true
          )
          OR EXISTS (
            SELECT 1
            FROM genre_promotion_map AS mapped_parent
            WHERE mapped_parent.old_id = genre.parent_id
          )
        )
      ORDER BY genre.created_at, genre.name
    LOOP
      SELECT mapped_parent.new_id INTO target_parent_id
      FROM genre_promotion_map AS mapped_parent
      WHERE mapped_parent.old_id = genre_record.parent_id;

      target_parent_id := COALESCE(target_parent_id, genre_record.parent_id);

      SELECT system_genre.id INTO existing_system_id
      FROM public.genres AS system_genre
      WHERE system_genre.is_system = true
        AND lower(system_genre.name) = lower(genre_record.name)
        AND COALESCE(system_genre.parent_id, '00000000-0000-0000-0000-000000000000'::uuid) =
            COALESCE(target_parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY system_genre.created_at
      LIMIT 1;

      IF existing_system_id IS NOT NULL THEN
        INSERT INTO public.book_genres (book_id, genre_id)
        SELECT book_id, existing_system_id
        FROM public.book_genres
        WHERE genre_id = genre_record.id
        ON CONFLICT DO NOTHING;

        INSERT INTO genre_promotion_map (old_id, new_id)
        VALUES (genre_record.id, existing_system_id)
        ON CONFLICT (old_id) DO UPDATE SET new_id = EXCLUDED.new_id;
      ELSE
        UPDATE public.genres
        SET parent_id = target_parent_id,
            user_id = NULL,
            is_system = true
        WHERE id = genre_record.id;

        INSERT INTO genre_promotion_map (old_id, new_id)
        VALUES (genre_record.id, genre_record.id)
        ON CONFLICT (old_id) DO UPDATE SET new_id = EXCLUDED.new_id;
      END IF;

      promoted_count := promoted_count + 1;
    END LOOP;

    EXIT WHEN promoted_count = 0;
  END LOOP;

  DELETE FROM public.genres AS duplicate_genre
  USING genre_promotion_map AS mapped
  WHERE duplicate_genre.id = mapped.old_id
    AND mapped.old_id <> mapped.new_id;

  IF EXISTS (
    SELECT 1
    FROM public.genres
    WHERE user_id = martina_user_id
      AND is_system = false
  ) THEN
    RAISE EXCEPTION 'Some Martina custom genres could not be promoted because their parent chain could not be resolved.';
  END IF;
END $$;

DROP POLICY IF EXISTS "genres: owner insert custom" ON public.genres;
DROP POLICY IF EXISTS "genres: owner update custom" ON public.genres;
DROP POLICY IF EXISTS "genres: owner delete custom" ON public.genres;
