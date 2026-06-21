-- Follow-up for chat profile lookup.
-- If the original chat migration was already applied before these RPCs existed,
-- Supabase will not rerun that edited migration. This migration creates the
-- functions explicitly and removes the old public_profiles view.

DROP VIEW IF EXISTS public_profiles;

CREATE OR REPLACE FUNCTION search_public_profiles(search_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.created_at
  FROM profiles
  WHERE auth.uid() IS NOT NULL
    AND profiles.id <> auth.uid()
    AND length(btrim(search_query)) >= 2
    AND (
      profiles.username ILIKE '%' || lower(btrim(search_query)) || '%'
      OR profiles.display_name ILIKE '%' || btrim(search_query) || '%'
    )
  ORDER BY profiles.username NULLS LAST, profiles.display_name NULLS LAST
  LIMIT 8;
$$;

GRANT EXECUTE ON FUNCTION search_public_profiles(text) TO authenticated;

CREATE OR REPLACE FUNCTION get_public_profile_by_username(username_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.created_at
  FROM profiles
  WHERE auth.uid() IS NOT NULL
    AND profiles.username = lower(btrim(username_query))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_public_profile_by_username(text) TO authenticated;

CREATE OR REPLACE FUNCTION get_public_profiles(profile_ids uuid[])
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.created_at
  FROM profiles
  WHERE auth.uid() IS NOT NULL
    AND profiles.id = ANY(profile_ids);
$$;

GRANT EXECUTE ON FUNCTION get_public_profiles(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
