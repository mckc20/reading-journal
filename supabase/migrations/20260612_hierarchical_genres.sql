-- Hierarchical genres with shared system rows and user-owned custom rows.

CREATE TABLE IF NOT EXISTS public.genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.genres(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(name) <> ''),
  CHECK (
    (is_system = true AND user_id IS NULL)
    OR (is_system = false AND user_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.book_genres (
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  genre_id uuid NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, genre_id)
);

CREATE INDEX IF NOT EXISTS genres_parent_id_idx ON public.genres(parent_id);
CREATE INDEX IF NOT EXISTS genres_user_id_idx ON public.genres(user_id);
CREATE INDEX IF NOT EXISTS genres_is_system_idx ON public.genres(is_system);
CREATE INDEX IF NOT EXISTS book_genres_genre_id_idx ON public.book_genres(genre_id);

CREATE UNIQUE INDEX IF NOT EXISTS genres_unique_system_sibling_name_idx
  ON public.genres (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE is_system = true;

CREATE UNIQUE INDEX IF NOT EXISTS genres_unique_user_sibling_name_idx
  ON public.genres (user_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE is_system = false;

CREATE OR REPLACE FUNCTION public.prevent_genre_cycles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_parent uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A genre cannot be its own parent.';
  END IF;

  current_parent := NEW.parent_id;

  WHILE current_parent IS NOT NULL LOOP
    IF current_parent = NEW.id THEN
      RAISE EXCEPTION 'A genre cannot be moved below one of its own descendants.';
    END IF;

    SELECT parent_id INTO current_parent
    FROM public.genres
    WHERE id = current_parent;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS genres_prevent_cycles ON public.genres;
CREATE TRIGGER genres_prevent_cycles
  BEFORE INSERT OR UPDATE OF parent_id ON public.genres
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_genre_cycles();

DROP TRIGGER IF EXISTS genres_set_updated_at ON public.genres;
CREATE TRIGGER genres_set_updated_at
  BEFORE UPDATE ON public.genres
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.can_use_genre(genre_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.genres
    WHERE id = genre_uuid
      AND (is_system = true OR user_id = user_uuid)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_use_genre_parent(parent_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT parent_uuid IS NULL OR public.can_use_genre(parent_uuid, user_uuid);
$$;

ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_genres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "genres: visible select" ON public.genres;
CREATE POLICY "genres: visible select"
  ON public.genres FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "genres: owner insert custom" ON public.genres;
CREATE POLICY "genres: owner insert custom"
  ON public.genres FOR INSERT
  WITH CHECK (
    is_system = false
    AND auth.uid() = user_id
    AND public.can_use_genre_parent(parent_id, auth.uid())
  );

DROP POLICY IF EXISTS "genres: owner update custom" ON public.genres;
CREATE POLICY "genres: owner update custom"
  ON public.genres FOR UPDATE
  USING (is_system = false AND auth.uid() = user_id)
  WITH CHECK (
    is_system = false
    AND auth.uid() = user_id
    AND public.can_use_genre_parent(parent_id, auth.uid())
  );

DROP POLICY IF EXISTS "genres: owner delete custom" ON public.genres;
CREATE POLICY "genres: owner delete custom"
  ON public.genres FOR DELETE
  USING (is_system = false AND auth.uid() = user_id);

DROP POLICY IF EXISTS "book_genres: owner select" ON public.book_genres;
CREATE POLICY "book_genres: owner select"
  ON public.book_genres FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = book_genres.book_id
        AND books.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "book_genres: owner insert" ON public.book_genres;
CREATE POLICY "book_genres: owner insert"
  ON public.book_genres FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = book_genres.book_id
        AND books.user_id = auth.uid()
    )
    AND public.can_use_genre(genre_id, auth.uid())
  );

DROP POLICY IF EXISTS "book_genres: owner delete" ON public.book_genres;
CREATE POLICY "book_genres: owner delete"
  ON public.book_genres FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.books
      WHERE books.id = book_genres.book_id
        AND books.user_id = auth.uid()
    )
  );

DO $$
DECLARE
  genre_record record;
  parent_genre_id uuid;
BEGIN
  FOR genre_record IN
    SELECT *
    FROM (
      VALUES
        ('Fiction', NULL, 0),
        ('Non-Fiction', NULL, 0),
        ('Age Target', NULL, 0),

        ('Literary Fiction', 'Fiction', 1),
        ('Contemporary Fiction', 'Fiction', 1),
        ('Historical Fiction', 'Fiction', 1),
        ('Romance', 'Fiction', 1),
        ('Mystery & Crime', 'Fiction', 1),
        ('Thriller & Suspense', 'Fiction', 1),
        ('Science Fiction', 'Fiction', 1),
        ('Fantasy', 'Fiction', 1),
        ('Horror', 'Fiction', 1),
        ('Action & Adventure', 'Fiction', 1),
        ('Humor & Satire', 'Fiction', 1),

        ('Biography & Memoir', 'Non-Fiction', 1),
        ('History', 'Non-Fiction', 1),
        ('True Crime', 'Non-Fiction', 1),
        ('Politics & Current Events', 'Non-Fiction', 1),
        ('Self-Help & Personal Development', 'Non-Fiction', 1),
        ('Business & Economics', 'Non-Fiction', 1),
        ('Science & Technology', 'Non-Fiction', 1),
        ('Philosophy & Spirituality', 'Non-Fiction', 1),
        ('Health & Wellness', 'Non-Fiction', 1),
        ('Travel', 'Non-Fiction', 1),
        ('Cookbooks & Food', 'Non-Fiction', 1),
        ('Art, Photography & Design', 'Non-Fiction', 1),
        ('Essays & Anthologies', 'Non-Fiction', 1),

        ('Children''s', 'Age Target', 1),
        ('Middle Grade', 'Age Target', 1),
        ('Young Adult', 'Age Target', 1),
        ('New Adult', 'Age Target', 1),
        ('Adult', 'Age Target', 1),

        ('Space Opera', 'Science Fiction', 2),
        ('Dystopian', 'Science Fiction', 2),
        ('Hard Sci-Fi', 'Science Fiction', 2),
        ('High Fantasy', 'Fantasy', 2),
        ('Epic Fantasy', 'Fantasy', 2),
        ('Urban Fantasy', 'Fantasy', 2),
        ('Popular Science', 'Science & Technology', 2),
        ('Nature & Environment', 'Science & Technology', 2)
    ) AS genres_to_seed(name, parent_name, sort_order)
    ORDER BY sort_order, name
  LOOP
    IF genre_record.parent_name IS NULL THEN
      parent_genre_id := NULL;
    ELSE
      SELECT id INTO parent_genre_id
      FROM public.genres
      WHERE is_system = true
        AND name = genre_record.parent_name
      LIMIT 1;
    END IF;

    INSERT INTO public.genres (name, parent_id, user_id, is_system)
    VALUES (genre_record.name, parent_genre_id, NULL, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

DO $$
DECLARE
  book_record record;
  genre_label text;
  canonical_genre_label text;
  matching_genre_id uuid;
  custom_genre_id uuid;
  fallback_parent_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'genres'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO fallback_parent_id
  FROM public.genres
  WHERE is_system = true
    AND name = 'Fiction'
    AND parent_id IS NULL
  LIMIT 1;

  FOR book_record IN
    SELECT id, user_id, genres
    FROM public.books
    WHERE genres IS NOT NULL
  LOOP
    FOREACH genre_label IN ARRAY book_record.genres LOOP
      genre_label := btrim(genre_label);
      IF genre_label = '' THEN
        CONTINUE;
      END IF;

      canonical_genre_label := CASE lower(genre_label)
        WHEN 'science fiction' THEN 'Science Fiction'
        WHEN 'sci-fi' THEN 'Science Fiction'
        WHEN 'mystery' THEN 'Mystery & Crime'
        WHEN 'crime' THEN 'Mystery & Crime'
        WHEN 'thriller' THEN 'Thriller & Suspense'
        WHEN 'suspense' THEN 'Thriller & Suspense'
        WHEN 'adventure' THEN 'Action & Adventure'
        WHEN 'children''s' THEN 'Children''s'
        WHEN 'childrens' THEN 'Children''s'
        WHEN 'middle grade / mg' THEN 'Middle Grade'
        WHEN 'middle grade' THEN 'Middle Grade'
        WHEN 'young adult' THEN 'Young Adult'
        WHEN 'ya' THEN 'Young Adult'
        WHEN 'new adult / na' THEN 'New Adult'
        WHEN 'new adult' THEN 'New Adult'
        WHEN 'memoir' THEN 'Biography & Memoir'
        WHEN 'autobiography' THEN 'Biography & Memoir'
        WHEN 'biography' THEN 'Biography & Memoir'
        WHEN 'politics' THEN 'Politics & Current Events'
        WHEN 'current events' THEN 'Politics & Current Events'
        WHEN 'self-help' THEN 'Self-Help & Personal Development'
        WHEN 'self-improvement' THEN 'Self-Help & Personal Development'
        WHEN 'personal development' THEN 'Self-Help & Personal Development'
        WHEN 'business' THEN 'Business & Economics'
        WHEN 'science' THEN 'Science & Technology'
        WHEN 'cooking/food' THEN 'Cookbooks & Food'
        WHEN 'cookbooks / food' THEN 'Cookbooks & Food'
        WHEN 'art/design' THEN 'Art, Photography & Design'
        WHEN 'comedy' THEN 'Humor & Satire'
        WHEN 'satire' THEN 'Humor & Satire'
        WHEN 'humor' THEN 'Humor & Satire'
        WHEN 'wellness' THEN 'Health & Wellness'
        WHEN 'philosophy' THEN 'Philosophy & Spirituality'
        WHEN 'spirituality' THEN 'Philosophy & Spirituality'
        WHEN 'essays' THEN 'Essays & Anthologies'
        WHEN 'anthologies' THEN 'Essays & Anthologies'
        ELSE genre_label
      END;

      IF canonical_genre_label IS NULL THEN
        CONTINUE;
      END IF;

      SELECT id INTO matching_genre_id
      FROM public.genres
      WHERE is_system = true
        AND lower(name) = lower(canonical_genre_label)
      ORDER BY parent_id NULLS FIRST
      LIMIT 1;

      IF matching_genre_id IS NULL THEN
        SELECT id INTO custom_genre_id
        FROM public.genres
        WHERE is_system = false
          AND user_id = book_record.user_id
          AND parent_id IS NOT DISTINCT FROM fallback_parent_id
          AND lower(name) = lower(genre_label)
        LIMIT 1;

        IF custom_genre_id IS NULL THEN
          INSERT INTO public.genres (name, parent_id, user_id, is_system)
          VALUES (genre_label, fallback_parent_id, book_record.user_id, false)
          RETURNING id INTO custom_genre_id;
        END IF;

        matching_genre_id := custom_genre_id;
      END IF;

      INSERT INTO public.book_genres (book_id, genre_id)
      VALUES (book_record.id, matching_genre_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
