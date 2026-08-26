-- Keep profile reads behind security-definer functions and expose only fields
-- intended for authenticated users to see on the public profile page.

DROP FUNCTION IF EXISTS search_public_profiles(text);
DROP FUNCTION IF EXISTS get_public_profile_by_username(text);
DROP FUNCTION IF EXISTS get_public_profiles(uuid[]);

CREATE OR REPLACE FUNCTION search_public_profiles(search_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.bio, profiles.created_at
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

CREATE OR REPLACE FUNCTION get_public_profile_by_username(username_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.bio, profiles.created_at
  FROM profiles
  WHERE auth.uid() IS NOT NULL
    AND profiles.username = lower(btrim(username_query))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_public_profiles(profile_ids uuid[])
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.username, profiles.display_name, profiles.avatar_url, profiles.bio, profiles.created_at
  FROM profiles
  WHERE auth.uid() IS NOT NULL
    AND profiles.id = ANY(profile_ids);
$$;

GRANT EXECUTE ON FUNCTION search_public_profiles(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_profile_by_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_profiles(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
