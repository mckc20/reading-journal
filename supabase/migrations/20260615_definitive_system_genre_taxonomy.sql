-- Normalize the system taxonomy to the final default genre list.
-- Renames/merges preserve book assignments where there is a clear replacement.

CREATE OR REPLACE FUNCTION pg_temp.system_genre_id(target_name text, parent_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT child.id
  FROM public.genres AS child
  LEFT JOIN public.genres AS parent ON parent.id = child.parent_id
  WHERE child.is_system = true
    AND child.name = target_name
    AND (
      parent_name IS NULL
      OR parent.name = parent_name
    )
  ORDER BY child.created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.merge_or_rename_system_genre(
  old_name text,
  new_name text,
  old_parent_name text DEFAULT NULL,
  new_parent_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  old_id uuid;
  new_id uuid;
  new_parent_id uuid;
BEGIN
  old_id := pg_temp.system_genre_id(old_name, old_parent_name);
  IF old_id IS NULL THEN
    RETURN;
  END IF;

  IF new_parent_name IS NOT NULL THEN
    new_parent_id := pg_temp.system_genre_id(new_parent_name);
  END IF;

  new_id := pg_temp.system_genre_id(new_name, new_parent_name);

  IF new_id IS NULL THEN
    UPDATE public.genres
    SET name = new_name,
        parent_id = COALESCE(new_parent_id, parent_id)
    WHERE id = old_id;
    RETURN;
  END IF;

  IF old_id = new_id THEN
    RETURN;
  END IF;

  INSERT INTO public.book_genres (book_id, genre_id)
  SELECT book_id, new_id
  FROM public.book_genres
  WHERE genre_id = old_id
  ON CONFLICT DO NOTHING;

  DELETE FROM public.genres
  WHERE id = old_id;
END;
$$;

DO $$
DECLARE
  genre_record record;
  parent_genre_id uuid;
BEGIN
  CREATE TEMP TABLE final_system_genres (
    name text NOT NULL,
    parent_name text,
    sort_order integer NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO final_system_genres (name, parent_name, sort_order)
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
    ('Nature & Environment', 'Science & Technology', 2);

  FOR genre_record IN
    SELECT *
    FROM final_system_genres
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

  -- Root and age target label cleanup.
  PERFORM pg_temp.merge_or_rename_system_genre('Children''s', 'Children''s', 'Age Target Tags (not genres)', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Children''s', 'Children''s', 'Age Targets', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Children''s', 'Children''s', 'Age Target Tags', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Middle Grade / MG', 'Middle Grade', 'Age Target Tags (not genres)', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Middle Grade / MG', 'Middle Grade', 'Age Targets', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Middle Grade / MG', 'Middle Grade', 'Age Target Tags', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Middle Grade', 'Middle Grade', 'Age Target Tags (not genres)', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Middle Grade', 'Middle Grade', 'Age Targets', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Middle Grade', 'Middle Grade', 'Age Target Tags', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('New Adult / NA', 'New Adult', 'Age Target Tags (not genres)', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('New Adult / NA', 'New Adult', 'Age Targets', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('New Adult / NA', 'New Adult', 'Age Target Tags', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('New Adult', 'New Adult', 'Age Target Tags (not genres)', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('New Adult', 'New Adult', 'Age Targets', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('New Adult', 'New Adult', 'Age Target Tags', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Young Adult', 'Young Adult', 'Age Target Tags (not genres)', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Young Adult', 'Young Adult', 'Age Targets', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Young Adult', 'Young Adult', 'Age Target Tags', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Adult', 'Adult', 'Age Target Tags (not genres)', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Adult', 'Adult', 'Age Targets', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Adult', 'Adult', 'Age Target Tags', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Age Target Tags (not genres)', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Age Targets', 'Age Target');
  PERFORM pg_temp.merge_or_rename_system_genre('Age Target Tags', 'Age Target');

  -- Fiction renames/merges.
  PERFORM pg_temp.merge_or_rename_system_genre('Comedy', 'Humor & Satire', 'Fiction', 'Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Satire / Humor', 'Humor & Satire', 'Fiction', 'Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Science Fiction (Sci-Fi)', 'Science Fiction', 'Fiction', 'Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Urban / Modern Fantasy', 'Urban Fantasy', 'Fantasy', 'Fantasy');
  PERFORM pg_temp.merge_or_rename_system_genre('Dystopian / Cyberpunk', 'Dystopian', 'Science Fiction', 'Science Fiction');

  -- Non-fiction renames/merges.
  PERFORM pg_temp.merge_or_rename_system_genre('Biography', 'Biography & Memoir', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Autobiography / Memoir', 'Biography & Memoir', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Memoir', 'Biography & Memoir', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Self-Improvement', 'Self-Help & Personal Development', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Self-Help', 'Self-Help & Personal Development', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Philosophy', 'Philosophy & Spirituality', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Spirituality & Philosophy', 'Philosophy & Spirituality', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Religion/Spirituality', 'Philosophy & Spirituality', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Health, Wellness & Fitness', 'Health & Wellness', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Cookbooks / Food', 'Cookbooks & Food', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Cooking/Food', 'Cookbooks & Food', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Essays', 'Essays & Anthologies', 'Non-Fiction', 'Non-Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Anthologies', 'Essays & Anthologies', 'Non-Fiction', 'Non-Fiction');

  -- Delete all remaining system rows that are not in the final list.
  DELETE FROM public.genres AS genre
  WHERE genre.is_system = true
    AND NOT EXISTS (
      SELECT 1
      FROM final_system_genres AS final
      LEFT JOIN public.genres AS parent ON parent.id = genre.parent_id
      WHERE final.name = genre.name
        AND (
          (final.parent_name IS NULL AND genre.parent_id IS NULL)
          OR final.parent_name = parent.name
        )
    );
END $$;
