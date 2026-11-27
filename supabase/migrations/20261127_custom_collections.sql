BEGIN;

CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name = regexp_replace(name, '^\s+|\s+$', '', 'g') AND char_length(name) BETWEEN 1 AND 80),
  description text CHECK (char_length(description) <= 500)
);

CREATE UNIQUE INDEX collections_owner_name_idx ON public.collections (user_id, lower(name));

CREATE TABLE public.collection_books (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, book_id)
);

CREATE INDEX collection_books_book_id_idx ON public.collection_books (book_id);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_books ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.collections, public.collection_books FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.collections TO authenticated;
GRANT UPDATE (name, description) ON public.collections TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.collection_books TO authenticated;

CREATE POLICY collections_owner ON public.collections
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY collection_books_owner ON public.collection_books
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_books.collection_id AND c.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.books b WHERE b.id = collection_books.book_id AND b.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_books.collection_id AND c.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.books b WHERE b.id = collection_books.book_id AND b.user_id = (SELECT auth.uid()))
  );

COMMIT;
