# Phase 2: Database Design & Authentication

## What was set up

### Database Schema
All three tables are defined in `supabase/schema.sql` — run this once in the Supabase SQL Editor after creating the project.

**`series`** — created before `books` to satisfy the foreign key dependency:
- `id` (uuid, PK), `user_id` (FK → auth.users), `name`, `journal_content`, `created_at`

**`books`** — core entity:
- `id`, `user_id`, `title`, `author`, `genre`, `status`, `cover_url`, `rating`, `is_favorite`, `current_page`, `total_pages`, `current_chapter`, `total_chapters`, `date_started`, `date_finished`, `language`, `belongs_to`, `format`, `series_id` (FK → series), `volume_number`, `created_at`
- `status`, `language`, `belongs_to`, `format` use `text + CHECK` constraints rather than PG enums — adding new values never requires a schema migration

**`reading_logs`** — per-session entries:
- `id`, `user_id`, `book_id` (FK → books), `current_page`, `reading_time_minutes`, `logged_at`

**FK cascade behaviour:**
- `books.series_id` → `ON DELETE SET NULL` — deleting a series keeps its books
- `reading_logs.book_id` → `ON DELETE CASCADE` — logs are meaningless without their book
- All `user_id` columns → `ON DELETE CASCADE` — deleting an auth user wipes all their data

**Indexes:**
- `(user_id)` on all three tables (primary filter on every query)
- `(user_id, status)` on `books` (supports the "currently reading" dashboard query)
- `(book_id)` on `reading_logs`

### Row Level Security
RLS is enabled on all three tables. Each has four policies (SELECT, INSERT, UPDATE, DELETE) scoped to `auth.uid() = user_id`. Queries via the anon/client key can never touch another user's rows regardless of how they're constructed.

### Auth Context (`src/context/AuthContext.tsx`)
Exports `AuthProvider` and `useAuth`. State: `user`, `session`, `loading`, `signIn`, `signOut`.

- `loading` starts `true` and is set to `false` only after `getSession()` resolves — this prevents a flash redirect to `/login` on hard refresh for authenticated users
- `onAuthStateChange` keeps state in sync with sign-in/sign-out/token-refresh events but deliberately does not touch `loading` (would cause a flicker on background token refreshes)
- `AuthProvider` must wrap `RouterProvider` in `App.tsx` so the context is stable across route transitions

### Protected Routing (`src/components/ProtectedRoute.tsx`)
Uses React Router v7's layout route pattern — `ProtectedRoute` has no `path`, wraps protected children via `<Outlet />`.

- Checks `loading` before `user` — without this guard, authenticated users see a flash redirect on every hard refresh
- Passes `{ from: location }` in navigation state when redirecting to `/login` so the login page can redirect back to the originally intended route after sign-in

Router structure in `src/lib/router.tsx`:
```
/login         → Login (public)
<ProtectedRoute>
  /            → Dashboard stub
  /library     → Library stub
*              → 404 (outside protected wrapper)
```

### Login Page (`src/pages/Login.tsx`)
- `react-hook-form` with shadcn `Input` / `Label` / `Button` (no shadcn `form` component in v4)
- Checks `loading` first — renders a spinner if auth state isn't resolved yet
- Redirects to `/` (or back to `location.state.from`) on success
- Supabase errors surface as a `root` form error below the submit button
- Mobile-first layout: centered card, full-width button, `min-h-svh`

### Invite Script (`scripts/invite-user.ts`)
Uses the Supabase Admin API (`auth.admin.inviteUserByEmail`) with the **Secret key** (service role key). This client bypasses RLS and must never appear in any file under `src/`.

```bash
npm run invite user@example.com
```

- `redirectTo` defaults to `http://localhost:5173/login` but reads `INVITE_REDIRECT_URL` from `.env` so production invites point to the Vercel URL
- Both `http://localhost:5173/login` and the production URL must be added to Supabase → Auth → URL Configuration → **Redirect URLs**

### Setting a password after accepting an invite
Supabase invite links log the user in automatically but leave no password set. To set one, open the browser console while logged in and run:
```js
await supabase.auth.updateUser({ password: "your-new-password" })
```
This only needs to be done once per user. Future logins use the normal login form.

## New dependencies

| Package | Type | Purpose |
|---|---|---|
| `react-hook-form` | dependency | Form state and validation in Login page |
| `tsx` | devDependency | Runs the TypeScript invite script with Node |
| `dotenv` | devDependency | Loads `.env` in the invite script |

## Key files

| File | Purpose |
|---|---|
| `supabase/schema.sql` | Full schema + RLS — run once in Supabase SQL Editor |
| `src/context/AuthContext.tsx` | Auth state, `AuthProvider`, `useAuth` hook |
| `src/context/index.ts` | Re-exports `AuthProvider` and `useAuth` |
| `src/pages/Login.tsx` | Login form with redirect-back-after-login support |
| `src/components/ProtectedRoute.tsx` | Layout route guard with loading state |
| `src/lib/router.tsx` | Updated route tree with protected layout route |
| `src/App.tsx` | Wrapped `RouterProvider` with `AuthProvider` |
| `scripts/invite-user.ts` | Admin invite script (uses Secret key, never in src/) |
| `.env.example` | Template — now includes `SUPABASE_SERVICE_ROLE_KEY` and `INVITE_REDIRECT_URL` |

## Environment variables

| Variable | Where to find it | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API | App (client) |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → **Publishable key** | App (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **Secret key** | `scripts/invite-user.ts` only |
| `INVITE_REDIRECT_URL` | Set manually | `scripts/invite-user.ts` — defaults to `http://localhost:5173` |

**Key naming note:** Supabase recently renamed their keys in the dashboard. "Publishable key" = the old "anon key". "Secret key" = the old "service role key". The functionality is identical.

## Supabase dashboard checklist

- [ ] Run `supabase/schema.sql` in SQL Editor
- [ ] Authentication → Settings → disable **Enable Sign Ups**
- [ ] Authentication → URL Configuration → **Site URL** set to production URL
- [ ] Authentication → URL Configuration → **Redirect URLs** — add both `http://localhost:5173/login` and the production URL

## Before starting Phase 3

The protected routes (`/` and `/library`) still render stub components. Phase 3 replaces them with real page components: the Dashboard with currently-reading cards, the Add Book form, the Detail Modal, and Library views.
