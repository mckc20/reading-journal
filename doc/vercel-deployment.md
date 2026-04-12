# Vercel Deployment

## What was done

Added `vercel.json` at the project root with a single SPA rewrite rule so that React Router's client-side routing works correctly in production. Without this, direct navigation to routes like `/library` would return a Vercel 404 instead of loading the app.

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

Vercel auto-detects the Vite framework and configures:
- **Build command:** `npm run build`
- **Output directory:** `dist`

No other project files were changed.

## Deployment steps (Vercel dashboard)

1. Go to [vercel.com/new](https://vercel.com/new) and import the `mckc20/reading-journal` GitHub repo.
2. Add environment variables before the first deploy:
   - `VITE_SUPABASE_URL` — Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — Supabase publishable/anon key
3. Deploy. Vercel will run `npm run build` and serve the `dist/` directory.

## Post-deploy: Supabase configuration

In the Supabase dashboard (Authentication > URL Configuration), add the Vercel production URL (e.g. `https://reading-journal-xxx.vercel.app`) to the **Redirect URLs** allow list. Without this, auth redirects after login will be blocked by Supabase.

## Verification

1. Visit the Vercel URL — login page loads
2. Log in — Supabase auth completes and redirects back to the app
3. Navigate directly to `/library` in the browser — SPA routing works (no 404)
4. Confirm books load correctly (environment variables are wired up)
