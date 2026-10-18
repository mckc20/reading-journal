-- Snapshots are private and immutable through the app. Only the backend creates them.
CREATE TABLE public.wrap_up_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'yearly')),
  period_key text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date > start_date),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL CHECK (end_at > start_at),
  timezone text NOT NULL,
  timezone_fallback boolean NOT NULL,
  payload_version integer NOT NULL CHECK (payload_version > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  is_historical boolean NOT NULL,
  source_as_of timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_type, period_key),
  CHECK ((period_type = 'monthly' AND period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    OR (period_type = 'yearly' AND period_key ~ '^[0-9]{4}$'))
);
ALTER TABLE public.wrap_up_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wrap_up_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.wrap_up_reports TO authenticated;
GRANT SELECT, INSERT ON public.wrap_up_reports TO service_role;
CREATE POLICY "wrap_up_reports: owner select" ON public.wrap_up_reports
  FOR SELECT TO authenticated USING (user_id = auth.uid());
