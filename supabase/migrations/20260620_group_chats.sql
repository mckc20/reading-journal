-- Add chat behavior to the existing groups feature.
-- Groups are now the shared container for both direct and group chats.

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'group'
    CHECK (kind IN ('direct', 'group')),
  ADD COLUMN IF NOT EXISTS direct_pair_key text;

ALTER TABLE group_memberships
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

CREATE TABLE IF NOT EXISTS group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  CHECK (
    deleted_at IS NOT NULL
    OR length(btrim(content)) > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS groups_direct_pair_key_unique_idx
  ON groups (direct_pair_key)
  WHERE kind = 'direct';

CREATE INDEX IF NOT EXISTS groups_kind_idx ON groups(kind);
CREATE INDEX IF NOT EXISTS group_memberships_last_read_at_idx ON group_memberships(group_id, last_read_at);
CREATE INDEX IF NOT EXISTS group_messages_group_created_at_idx ON group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_messages_sender_id_idx ON group_messages(sender_id);

DROP VIEW IF EXISTS public_profiles;

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION direct_pair_key_for(first_user_id uuid, second_user_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN first_user_id < second_user_id THEN first_user_id::text || ':' || second_user_id::text
    ELSE second_user_id::text || ':' || first_user_id::text
  END;
$$;

CREATE OR REPLACE FUNCTION prevent_invalid_direct_group_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  group_kind text;
  active_member_count integer;
BEGIN
  SELECT kind INTO group_kind
  FROM groups
  WHERE id = NEW.group_id;

  IF group_kind <> 'direct' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO active_member_count
    FROM group_memberships
    WHERE group_id = NEW.group_id
      AND status = 'active';
  ELSE
    SELECT count(*) INTO active_member_count
    FROM group_memberships
    WHERE group_id = NEW.group_id
      AND status = 'active'
      AND user_id <> OLD.user_id;
  END IF;

  IF active_member_count >= 2 THEN
    RAISE EXCEPTION 'Direct chats can only have two active members.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_memberships_prevent_invalid_direct ON group_memberships;

CREATE TRIGGER group_memberships_prevent_invalid_direct
  BEFORE INSERT OR UPDATE OF status ON group_memberships
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invalid_direct_group_membership();

CREATE OR REPLACE FUNCTION set_group_message_update_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.content = '';
  ELSIF NEW.deleted_at IS NULL AND NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.edited_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_messages_set_update_fields ON group_messages;

CREATE TRIGGER group_messages_set_update_fields
  BEFORE UPDATE ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_group_message_update_fields();

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

CREATE OR REPLACE FUNCTION create_group_with_owner(
  group_name text,
  group_description text DEFAULT NULL,
  group_avatar_url text DEFAULT NULL
)
RETURNS SETOF groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  new_group_id uuid := gen_random_uuid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF NULLIF(btrim(group_name), '') IS NULL THEN
    RAISE EXCEPTION 'Group name is required.';
  END IF;

  INSERT INTO profiles (id)
  VALUES (current_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO groups (id, name, description, avatar_url, created_by, kind)
  VALUES (
    new_group_id,
    btrim(group_name),
    NULLIF(btrim(group_description), ''),
    NULLIF(btrim(group_avatar_url), ''),
    current_user_id,
    'group'
  );

  INSERT INTO group_memberships (group_id, user_id, role, status, last_read_at)
  VALUES (new_group_id, current_user_id, 'owner', 'active', now());

  RETURN QUERY
  SELECT g.*
  FROM groups AS g
  WHERE g.id = new_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_group_with_owner(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION create_or_get_direct_group(other_user_id uuid)
RETURNS SETOF groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  pair_key text;
  existing_group_id uuid;
  new_group_id uuid := gen_random_uuid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF other_user_id IS NULL OR other_user_id = current_user_id THEN
    RAISE EXCEPTION 'Choose another user to start a chat.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'No app user exists for that profile.';
  END IF;

  INSERT INTO profiles (id)
  VALUES (current_user_id)
  ON CONFLICT (id) DO NOTHING;

  pair_key := direct_pair_key_for(current_user_id, other_user_id);

  SELECT id INTO existing_group_id
  FROM groups
  WHERE kind = 'direct'
    AND direct_pair_key = pair_key
  LIMIT 1;

  IF existing_group_id IS NOT NULL THEN
    INSERT INTO group_memberships (group_id, user_id, role, status, last_read_at)
    VALUES
      (existing_group_id, current_user_id, 'member', 'active', now()),
      (existing_group_id, other_user_id, 'member', 'active', NULL)
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET status = 'active';

    RETURN QUERY
    SELECT g.*
    FROM groups AS g
    WHERE g.id = existing_group_id;
    RETURN;
  END IF;

  INSERT INTO groups (id, name, created_by, kind, direct_pair_key)
  VALUES (new_group_id, 'Direct chat', current_user_id, 'direct', pair_key);

  INSERT INTO group_memberships (group_id, user_id, role, status, last_read_at)
  VALUES
    (new_group_id, current_user_id, 'member', 'active', now()),
    (new_group_id, other_user_id, 'member', 'active', NULL);

  RETURN QUERY
  SELECT g.*
  FROM groups AS g
  WHERE g.id = new_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_or_get_direct_group(uuid) TO authenticated;

CREATE POLICY "group_messages: member select"
  ON group_messages FOR SELECT
  USING (is_active_group_member(group_id, auth.uid()));

CREATE POLICY "group_messages: member insert"
  ON group_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND deleted_at IS NULL
    AND edited_at IS NULL
    AND is_active_group_member(group_id, auth.uid())
  );

CREATE POLICY "group_messages: sender update"
  ON group_messages FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND is_active_group_member(group_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND is_active_group_member(group_id, auth.uid())
  );

CREATE POLICY "group_messages: sender delete"
  ON group_messages FOR DELETE
  USING (
    auth.uid() = sender_id
    AND is_active_group_member(group_id, auth.uid())
  );

DROP POLICY IF EXISTS "group_memberships: manager insert" ON group_memberships;

CREATE POLICY "group_memberships: manager insert" ON group_memberships
  FOR INSERT
  WITH CHECK (
    (
      can_manage_group(group_id, auth.uid())
      AND EXISTS (
        SELECT 1
        FROM groups
        WHERE groups.id = group_memberships.group_id
          AND kind = 'group'
      )
    )
    OR (
      auth.uid() = user_id
      AND role = 'owner'
      AND status = 'active'
      AND is_group_creator(group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "group_memberships: manager update" ON group_memberships;

CREATE POLICY "group_memberships: manager update" ON group_memberships
  FOR UPDATE
  USING (
    can_manage_group(group_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM groups
      WHERE groups.id = group_memberships.group_id
        AND kind = 'group'
    )
  )
  WITH CHECK (
    can_manage_group(group_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM groups
      WHERE groups.id = group_memberships.group_id
        AND kind = 'group'
    )
  );

CREATE OR REPLACE FUNCTION mark_group_read(group_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF NOT is_active_group_member(group_uuid, current_user_id) THEN
    RAISE EXCEPTION 'You must be an active group member.';
  END IF;

  UPDATE group_memberships
  SET last_read_at = now()
  WHERE group_id = group_uuid
    AND user_id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_group_read(uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;
