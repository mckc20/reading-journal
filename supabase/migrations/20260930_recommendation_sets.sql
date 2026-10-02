CREATE TABLE IF NOT EXISTS recommendation_sets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz,
  expires_at timestamptz,
  strategy_version text,
  taste_fingerprint text,
  refresh_started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recommendation_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendation_sets_select_own ON recommendation_sets;
CREATE POLICY recommendation_sets_select_own
  ON recommendation_sets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON recommendation_sets FROM anon, authenticated;
GRANT SELECT ON recommendation_sets TO authenticated;
GRANT ALL ON recommendation_sets TO service_role;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS discover jsonb NOT NULL DEFAULT '{
    "reload_interval_number": 2,
    "reload_interval_unit": "day",
    "hide_disliked_recommendations": false,
    "recommendation_count": 6
  }'::jsonb;

CREATE TABLE IF NOT EXISTS public.recommendation_feedback (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  title text NOT NULL,
  authors jsonb NOT NULL DEFAULT '[]'::jsonb,
  genres jsonb NOT NULL DEFAULT '[]'::jsonb,
  item jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, candidate_key)
);

ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recommendation_feedback FROM anon, authenticated;
GRANT ALL ON public.recommendation_feedback TO service_role;

CREATE OR REPLACE FUNCTION claim_recommendation_refresh(
  p_user_id uuid,
  p_force boolean,
  p_taste_fingerprint text,
  p_strategy_version text,
  p_now timestamptz DEFAULT now(),
  p_lease_seconds integer DEFAULT 90,
  p_cooldown_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did_claim boolean;
BEGIN
  INSERT INTO recommendation_sets (
    user_id, items, strategy_version, taste_fingerprint, refresh_started_at, updated_at
  ) VALUES (
    p_user_id, '[]'::jsonb, p_strategy_version, p_taste_fingerprint, p_now, p_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    refresh_started_at = p_now,
    updated_at = p_now
  WHERE (recommendation_sets.refresh_started_at IS NULL
         OR recommendation_sets.refresh_started_at < p_now - make_interval(secs => p_lease_seconds))
    AND (p_force OR recommendation_sets.generated_at IS NULL
         OR recommendation_sets.expires_at <= p_now
         OR recommendation_sets.strategy_version IS DISTINCT FROM p_strategy_version
         OR recommendation_sets.taste_fingerprint IS DISTINCT FROM p_taste_fingerprint)
    AND (NOT p_force OR recommendation_sets.generated_at IS NULL
         OR recommendation_sets.generated_at < p_now - make_interval(secs => p_cooldown_seconds));

  did_claim := FOUND;
  RETURN did_claim;
END;
$$;

REVOKE ALL ON FUNCTION claim_recommendation_refresh(uuid, boolean, text, text, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_recommendation_refresh(uuid, boolean, text, text, timestamptz, integer, integer) TO service_role;
