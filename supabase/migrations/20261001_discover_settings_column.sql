ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS discover jsonb NOT NULL DEFAULT '{
    "reload_interval_number": 2,
    "reload_interval_unit": "day",
    "hide_disliked_recommendations": false,
    "recommendation_count": 6
  }'::jsonb;

NOTIFY pgrst, 'reload schema';
