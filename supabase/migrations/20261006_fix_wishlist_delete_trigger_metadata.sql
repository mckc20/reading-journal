-- Older deployed databases may not yet have the optional metadata-source
-- columns on books. Reading OLD through JSON keeps deletion safe in both
-- schema versions.
CREATE OR REPLACE FUNCTION public.return_wishlist_before_book_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE behavior text := COALESCE((SELECT reading->>'acquired_wishlist_book_deletion' FROM user_settings WHERE user_id = OLD.user_id), 'return_to_pending');
BEGIN
  IF behavior = 'remove_from_wishlist' THEN
    DELETE FROM wishlist_items WHERE book_id = OLD.id AND user_id = OLD.user_id;
  ELSE
    UPDATE wishlist_items
    SET book_id = NULL,
        title = OLD.title,
        cover_url = OLD.cover_url,
        cover_entity_id = CASE WHEN OLD.cover_url IS NULL THEN NULL ELSE OLD.id END,
        total_pages = OLD.total_pages,
        language = OLD.language,
        format = OLD.format,
        isbn = OLD.isbn,
        publication_date = OLD.publication_date,
        description = OLD.description,
        metadata_source = to_jsonb(OLD)->>'metadata_source',
        metadata_source_url = to_jsonb(OLD)->>'metadata_source_url'
    WHERE book_id = OLD.id AND user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END; $$;
NOTIFY pgrst, 'reload schema';
