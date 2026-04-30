-- Ensure every authenticated user has a matching app profile row.
-- group_memberships.user_id references profiles(id), so missing profiles cause
-- foreign key failures when group managers add existing auth users by UUID.

INSERT INTO profiles (id)
SELECT users.id
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user_profile();
