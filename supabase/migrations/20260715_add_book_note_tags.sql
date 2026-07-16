ALTER TABLE public.book_notes
  ADD COLUMN IF NOT EXISTS tags text[];

NOTIFY pgrst, 'reload schema';
