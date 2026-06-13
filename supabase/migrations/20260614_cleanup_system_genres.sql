-- Clean up earlier system genre seeds before applying the taxonomy in production.
-- Renames preserve book assignments. Explicit removals delete matching system rows.

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

CREATE OR REPLACE FUNCTION pg_temp.delete_system_genre(
  target_name text,
  parent_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := pg_temp.system_genre_id(target_name, parent_name);
  IF target_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.genres
  WHERE id = target_id;
END;
$$;

DO $$
DECLARE
  genre_record record;
  parent_genre_id uuid;
  fiction_id uuid;
  old_science_fiction_id uuid;
  bracket_science_fiction_id uuid;
  essays_old_id uuid;
  essays_id uuid;
  anthologies_id uuid;
BEGIN
  SELECT id INTO fiction_id
  FROM public.genres
  WHERE is_system = true
    AND name = 'Fiction'
    AND parent_id IS NULL
  LIMIT 1;

  -- If an older unbracketed Science Fiction branch exists, create a temporary
  -- bracketed branch so the requested "keep the bracketed one" rule has a
  -- stable target before deleting the older branch.
  old_science_fiction_id := pg_temp.system_genre_id('Science Fiction', 'Fiction');
  bracket_science_fiction_id := pg_temp.system_genre_id('Science Fiction (Sci-Fi)', 'Fiction');

  IF old_science_fiction_id IS NOT NULL
    AND bracket_science_fiction_id IS NULL
    AND fiction_id IS NOT NULL
  THEN
    INSERT INTO public.genres (name, parent_id, user_id, is_system)
    VALUES ('Science Fiction (Sci-Fi)', fiction_id, NULL, true)
    RETURNING id INTO bracket_science_fiction_id;

    INSERT INTO public.genres (name, parent_id, user_id, is_system)
    VALUES
      ('Space Opera', bracket_science_fiction_id, NULL, true),
      ('Dystopian', bracket_science_fiction_id, NULL, true),
      ('Hard Sci-Fi', bracket_science_fiction_id, NULL, true),
      ('Time Travel', bracket_science_fiction_id, NULL, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF old_science_fiction_id IS NOT NULL
    AND bracket_science_fiction_id IS NOT NULL
    AND old_science_fiction_id <> bracket_science_fiction_id
  THEN
    DELETE FROM public.genres WHERE id = old_science_fiction_id;
  END IF;

  PERFORM pg_temp.merge_or_rename_system_genre('Science Fiction (Sci-Fi)', 'Science Fiction', 'Fiction', 'Fiction');

  -- Ensure all kept canonical rows exist before merging old labels into them.
  FOR genre_record IN
    SELECT *
    FROM (
      VALUES
        ('Fiction', NULL, 0),
        ('Non-Fiction', NULL, 0),
        ('Age Target Tags (not genres)', NULL, 0),
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
        ('Comedy', 'Fiction', 1),
        ('Biography', 'Non-Fiction', 1),
        ('Autobiography / Memoir', 'Non-Fiction', 1),
        ('History', 'Non-Fiction', 1),
        ('True Crime', 'Non-Fiction', 1),
        ('Business & Economics', 'Non-Fiction', 1),
        ('Science & Technology', 'Non-Fiction', 1),
        ('Essays', 'Non-Fiction', 1),
        ('Anthologies', 'Non-Fiction', 1),
        ('Cookbooks / Food', 'Non-Fiction', 1),
        ('Art, Photography & Design', 'Non-Fiction', 1),
        ('Travel', 'Non-Fiction', 1),
        ('Health, Wellness & Fitness', 'Non-Fiction', 1),
        ('Self-Improvement', 'Non-Fiction', 1),
        ('Children''s', 'Age Target Tags (not genres)', 1),
        ('Middle Grade / MG', 'Age Target Tags (not genres)', 1),
        ('Young Adult', 'Age Target Tags (not genres)', 1),
        ('New Adult / NA', 'Age Target Tags (not genres)', 1),
        ('Adult', 'Age Target Tags (not genres)', 1),
        ('Standard Historical', 'Historical Fiction', 2),
        ('Alternate History', 'Historical Fiction', 2),
        ('Contemporary Romance', 'Romance', 2),
        ('Historical Romance', 'Romance', 2),
        ('Romantasy', 'Romance', 2),
        ('Cozy Mystery', 'Mystery & Crime', 2),
        ('Noir', 'Mystery & Crime', 2),
        ('Police Procedural', 'Mystery & Crime', 2),
        ('Whodunit', 'Mystery & Crime', 2),
        ('Detective', 'Mystery & Crime', 2),
        ('Psychological Thriller', 'Thriller & Suspense', 2),
        ('Espionage', 'Thriller & Suspense', 2),
        ('Legal Thriller', 'Thriller & Suspense', 2),
        ('Space Opera', 'Science Fiction', 2),
        ('Dystopian', 'Science Fiction', 2),
        ('Hard Sci-Fi', 'Science Fiction', 2),
        ('Time Travel', 'Science Fiction', 2),
        ('High Fantasy', 'Fantasy', 2),
        ('Low Fantasy', 'Fantasy', 2),
        ('Epic Fantasy', 'Fantasy', 2),
        ('Magical Realism', 'Fantasy', 2),
        ('Paranormal / Supernatural', 'Horror', 2),
        ('Gothic', 'Horror', 2),
        ('Psychological Horror', 'Horror', 2),
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

  -- Renames that should preserve book assignments.
  PERFORM pg_temp.merge_or_rename_system_genre('Slasher / Psychological Horror', 'Psychological Horror', 'Horror', 'Horror');
  PERFORM pg_temp.merge_or_rename_system_genre('Noir / Hardboiled', 'Noir', 'Mystery & Crime', 'Mystery & Crime');
  PERFORM pg_temp.merge_or_rename_system_genre('Fantasy Romance (Romantasy)', 'Romantasy', 'Romance', 'Romance');
  PERFORM pg_temp.merge_or_rename_system_genre('Satire / Humor', 'Comedy', 'Fiction', 'Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Dystopian / Cyberpunk', 'Dystopian', 'Science Fiction', 'Science Fiction');
  PERFORM pg_temp.merge_or_rename_system_genre('Espionage / Spy', 'Espionage', 'Thriller & Suspense', 'Thriller & Suspense');
  PERFORM pg_temp.merge_or_rename_system_genre('Legal / Medical Thriller', 'Legal Thriller', 'Thriller & Suspense', 'Thriller & Suspense');
  PERFORM pg_temp.merge_or_rename_system_genre('Children''s (0-8)', 'Children''s', 'Age Target Tags (not genres)', 'Age Target Tags (not genres)');
  PERFORM pg_temp.merge_or_rename_system_genre('Middle Grade / MG (8-12)', 'Middle Grade / MG', 'Age Target Tags (not genres)', 'Age Target Tags (not genres)');
  PERFORM pg_temp.merge_or_rename_system_genre('Young Adult / YA (12-18)', 'Young Adult', 'Age Target Tags (not genres)', 'Age Target Tags (not genres)');
  PERFORM pg_temp.merge_or_rename_system_genre('New Adult / NA (18-25)', 'New Adult / NA', 'Age Target Tags (not genres)', 'Age Target Tags (not genres)');

  -- Split Essays & Anthologies into two independent genres, copying assignments
  -- to both new rows before deleting the combined row.
  essays_old_id := pg_temp.system_genre_id('Essays & Anthologies', 'Non-Fiction');
  essays_id := pg_temp.system_genre_id('Essays', 'Non-Fiction');
  anthologies_id := pg_temp.system_genre_id('Anthologies', 'Non-Fiction');

  IF essays_old_id IS NOT NULL THEN
    IF essays_id IS NOT NULL THEN
      INSERT INTO public.book_genres (book_id, genre_id)
      SELECT book_id, essays_id
      FROM public.book_genres
      WHERE genre_id = essays_old_id
      ON CONFLICT DO NOTHING;
    END IF;

    IF anthologies_id IS NOT NULL THEN
      INSERT INTO public.book_genres (book_id, genre_id)
      SELECT book_id, anthologies_id
      FROM public.book_genres
      WHERE genre_id = essays_old_id
      ON CONFLICT DO NOTHING;
    END IF;

    DELETE FROM public.genres WHERE id = essays_old_id;
  END IF;

  -- Keep Self-Improvement, but make it a direct Non-Fiction child before
  -- deleting its old parent branch.
  PERFORM pg_temp.merge_or_rename_system_genre('Self-Improvement', 'Self-Improvement', 'Self-Help & Personal Development', 'Non-Fiction');

  -- Explicit removals from earlier seed versions.
  PERFORM pg_temp.delete_system_genre('Children''s', 'Fiction');
  PERFORM pg_temp.delete_system_genre('Mystery', 'Fiction');
  PERFORM pg_temp.delete_system_genre('Thriller', 'Fiction');
  PERFORM pg_temp.delete_system_genre('Crime', 'Fiction');
  PERFORM pg_temp.delete_system_genre('Urban / Modern Fantasy', 'Fantasy');
  PERFORM pg_temp.delete_system_genre('Graphic Novel/Comics', 'Fiction');
  PERFORM pg_temp.delete_system_genre('Young Adult', 'Fiction');
  PERFORM pg_temp.delete_system_genre('Art/Design', 'Non-Fiction');
  PERFORM pg_temp.delete_system_genre('Business', 'Non-Fiction');
  PERFORM pg_temp.delete_system_genre('Cooking/Food', 'Non-Fiction');
  PERFORM pg_temp.delete_system_genre('Memoir', 'Non-Fiction');
  PERFORM pg_temp.delete_system_genre('Politics & Current Events', 'Non-Fiction');
  PERFORM pg_temp.delete_system_genre('Science', 'Non-Fiction');
  PERFORM pg_temp.delete_system_genre('Self-Help', 'Non-Fiction');
  PERFORM pg_temp.delete_system_genre('Self-Help & Personal Development', 'Non-Fiction');
  PERFORM pg_temp.delete_system_genre('Business & Finance');
  PERFORM pg_temp.delete_system_genre('Spirituality & Philosophy');
END $$;
