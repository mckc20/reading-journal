# Set Password Feature

Invited users arrive via Supabase magic links and have an active session but no password. Previously they had to run `supabase.auth.updateUser({ password })` in the browser console. This feature adds a proper UI for setting a password.

## How It Works

Supabase's `auth.updateUser({ password })` updates the current user's password **without requiring the old password**. This is the key enabler — invited users have a valid session but never set a password, so a "current password" prompt would be a dead end.

## Implementation

### New: `src/components/SetPasswordDialog.tsx`

A controlled dialog (`open` / `onOpenChange` props) following the same patterns as `AddBookDialog`:

- **Form fields:** New password (min 8 characters) + Confirm password
- **Validation:** react-hook-form inline `register` rules — required, minLength, and a `validate` function that checks passwords match
- **Submit:** Calls `supabase.auth.updateUser({ password })` directly (no AuthContext changes needed)
- **Success state:** Replaces the form with a confirmation message; form and state reset when the dialog closes
- **Error handling:** Supabase errors displayed via `setError("root", ...)` (same pattern as `Login.tsx`)

### Modified: `src/components/AppLayout.tsx`

- Added a `KeyRound` icon button in the header between Add Book and Sign Out
- Manages `passwordOpen` state and renders the `SetPasswordDialog`

### Modified: `src/components/index.ts`

- Added barrel export for `SetPasswordDialog`

## Design Decisions

- **Dialog over settings page:** The app has no settings page and creating one for a single action would be overkill. A dialog keeps the user in context.
- **No "current password" field:** Invited users don't have one. Supabase allows password updates on an active session without it.
- **Direct supabase import (not AuthContext):** This is a one-off action, not shared state. Adding it to the context would be unnecessary coupling.
- **No new dependencies:** Uses existing react-hook-form, shadcn/ui Dialog, and lucide-react icons.
