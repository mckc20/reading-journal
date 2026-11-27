BEGIN;

ALTER TABLE public.collection_books
  ADD COLUMN position integer CHECK (position > 0),
  ADD COLUMN added_at timestamptz NOT NULL DEFAULT now();

GRANT UPDATE (position) ON public.collection_books TO authenticated;

-- Apply membership changes and the draft order in one transaction under the caller's RLS policies.
CREATE FUNCTION public.save_collection_books(
  target_collection uuid, ordered_books uuid[], added_books uuid[], removed_books uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.collections WHERE id = target_collection FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection unavailable' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.collection_books
  WHERE collection_id = target_collection AND book_id = ANY(removed_books);

  INSERT INTO public.collection_books (collection_id, book_id)
  SELECT target_collection, id FROM unnest(added_books) AS ids(id)
  ON CONFLICT (collection_id, book_id) DO NOTHING;

  UPDATE public.collection_books AS membership
  SET position = ordered.position
  FROM unnest(ordered_books) WITH ORDINALITY AS ordered(book_id, position)
  WHERE membership.collection_id = target_collection AND membership.book_id = ordered.book_id
    AND membership.position IS DISTINCT FROM ordered.position;
END;
$$;

REVOKE ALL ON FUNCTION public.save_collection_books(uuid, uuid[], uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_collection_books(uuid, uuid[], uuid[], uuid[]) TO authenticated;

COMMIT;
