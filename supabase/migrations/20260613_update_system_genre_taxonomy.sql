-- Add the full system genre taxonomy requested for the hierarchical genre tree.
-- This is additive for already-migrated databases so existing book assignments are preserved.

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
