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

NOTIFY pgrst, 'reload schema';
