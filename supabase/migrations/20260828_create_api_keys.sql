-- User-managed credentials for the programmatic API. The raw secret is never
-- persisted: only its SHA-256 hash and a non-secret display prefix are stored.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS api_keys_user_active_created_idx
  ON public.api_keys (user_id, created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys: owner select"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "api_keys: owner insert"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "api_keys: owner update"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
