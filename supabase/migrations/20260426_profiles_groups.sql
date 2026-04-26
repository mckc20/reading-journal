-- Profiles and groups for app-specific user data and future sharing features.

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  avatar_url text,
  bio text,
  timezone text,
  language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_memberships (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles(created_at);
CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);
CREATE INDEX IF NOT EXISTS group_memberships_user_id_idx ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS group_memberships_group_id_idx ON group_memberships(group_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_active_group_member(group_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_id = group_uuid
      AND user_id = user_uuid
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION can_manage_group(group_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_id = group_uuid
      AND user_id = user_uuid
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_group_owner(group_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_id = group_uuid
      AND user_id = user_uuid
      AND role = 'owner'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_group_creator(group_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM groups
    WHERE id = group_uuid
      AND created_by = user_uuid
  );
$$;

-- profiles
CREATE POLICY "profiles: owner select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: owner insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: owner update" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- groups
CREATE POLICY "groups: member select" ON groups FOR SELECT USING (is_active_group_member(id, auth.uid()));
CREATE POLICY "groups: owner insert" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups: manager update" ON groups FOR UPDATE USING (can_manage_group(id, auth.uid())) WITH CHECK (can_manage_group(id, auth.uid()));
CREATE POLICY "groups: owner delete" ON groups FOR DELETE USING (is_group_owner(id, auth.uid()));

-- group_memberships
CREATE POLICY "group_memberships: member select" ON group_memberships
  FOR SELECT
  USING (is_active_group_member(group_id, auth.uid()));

CREATE POLICY "group_memberships: manager insert" ON group_memberships
  FOR INSERT
  WITH CHECK (
    can_manage_group(group_id, auth.uid())
    OR (
      auth.uid() = user_id
      AND role = 'owner'
      AND status = 'active'
      AND is_group_creator(group_id, auth.uid())
    )
  );

CREATE POLICY "group_memberships: manager update" ON group_memberships
  FOR UPDATE
  USING (can_manage_group(group_id, auth.uid()))
  WITH CHECK (can_manage_group(group_id, auth.uid()));

CREATE POLICY "group_memberships: self delete" ON group_memberships
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "group_memberships: owner delete" ON group_memberships
  FOR DELETE
  USING (is_group_owner(group_id, auth.uid()));
