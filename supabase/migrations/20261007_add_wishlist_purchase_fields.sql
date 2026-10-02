-- Align deployed Wishlist tables with the Add Book Wishlist form.
ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS volume_number numeric CHECK (volume_number > 0),
  ADD COLUMN IF NOT EXISTS price numeric(10,2) CHECK (price >= 0),
  ADD COLUMN IF NOT EXISTS purchase_url text;
NOTIFY pgrst, 'reload schema';
