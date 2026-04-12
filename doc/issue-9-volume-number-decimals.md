# Issue #9 -- volume_number doesn't accept decimal numbers

## Problem

The volume number field in both the Add Book dialog and the Book Detail modal only accepted integer values. Some book series use decimal volume numbers for novellas or side stories published between main entries (e.g., Stormlight Archive #3.5 for "Dawnshard").

## Changes

### Frontend

- **`src/components/BookDetailModal.tsx`** -- Added `step="any"` to the volume number `<Input>` and changed `min` from `1` to `0.5` so the browser allows decimal input.
- **`src/components/AddBookDialog.tsx`** -- Same change: added `step="any"` and changed `min` to `0.5`.

No change was needed for the `Number()` conversion used when building the Supabase payload, since `Number("3.5")` already returns `3.5` (unlike `parseInt` which would truncate to `3`).

### TypeScript types

No change needed. `volume_number` in `src/types/index.ts` is already typed as `number`, which covers both integers and floats.

### Database schema

- **`supabase/schema.sql`** -- Changed the column type from `integer` to `numeric` so it can store decimal values.

### Migration note

There is no `supabase/migrations/` directory in this repository. If the production database column is still `integer`, run the following SQL manually (or via the Supabase SQL Editor):

```sql
ALTER TABLE books ALTER COLUMN volume_number TYPE numeric USING volume_number::numeric;
```

The existing `CHECK (volume_number > 0)` constraint remains valid for the `numeric` type.
