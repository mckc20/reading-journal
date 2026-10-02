CREATE TABLE IF NOT EXISTS public.recommendation_history (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  item jsonb NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, candidate_key)
);

ALTER TABLE public.recommendation_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recommendation_history FROM anon, authenticated;
GRANT ALL ON public.recommendation_history TO service_role;

NOTIFY pgrst, 'reload schema';
