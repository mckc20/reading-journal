BEGIN;
-- Atomically delete a user's series, optionally deleting all linked books.
CREATE OR REPLACE FUNCTION public.delete_series(
  series_uuid uuid,
  delete_linked_books boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE owner_id uuid := auth.uid();
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;
  -- Lock the parent to prevent concurrent placement changes during deletion.
  PERFORM 1 FROM public.series WHERE id = series_uuid AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Series not found for this user.';
  END IF;
  IF delete_linked_books THEN
    -- Includes wishlist books; existing foreign keys cascade journals/logs/links.
    DELETE FROM public.books WHERE series_id = series_uuid AND user_id = owner_id;
  ELSE
    UPDATE public.books SET series_id = NULL WHERE series_id = series_uuid AND user_id = owner_id;
  END IF;
  DELETE FROM public.series WHERE id = series_uuid AND user_id = owner_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_series(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_series(uuid, boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
