-- Dismissals hide one exact recommendation only. Unlike feedback, they do not
-- influence the user's taste fingerprint or ranking signals.
CREATE TABLE IF NOT EXISTS public.recommendation_dismissals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, candidate_key)
);
ALTER TABLE public.recommendation_dismissals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recommendation_dismissals FROM anon, authenticated;
GRANT ALL ON public.recommendation_dismissals TO service_role;
NOTIFY pgrst, 'reload schema';
