# AGENTS.md

This file provides guidance to coding agents working in this repository. Check the current code and migrations before relying on older plans in `README.md` or `implementation-plan.md`.

## Project Overview

Reading Journal is an invite-only, multi-user web app for tracking books, reading progress, journals, and analytics. Supabase Auth identifies users; PostgreSQL Row Level Security (RLS) protects their data. The app runs on Vercel, including serverless API routes.

## Developer Context

The primary developer on this project is a self-taught junior software developer. When working in this repository, do not assume deep experience with architecture decisions, Supabase security/RLS, advanced TypeScript patterns, testing, or production deployment tradeoffs. Explain plans and changes in clear, practical terms, include the reasoning behind non-obvious decisions, and briefly call out risks or alternatives. Prefer incremental changes, readable code, and explanations that help the developer learn without overcomplicating the implementation.

- Experience level: self-taught junior developer
- Technologies I am comfortable with: basic HTML/CSS and general programming concepts
- Technologies I want more explanation for: React, TypeScript, SQL, Git, Tailwind, Supabase, auth, RLS, testing, and deployment
- Preferred explanation style: brief summaries, step-by-step plans, tradeoffs, and useful code comments
- Agent autonomy: For smaller changes, make reasonable decisions and explain them. For larger architectural changes, explain the tradeoffs first so I can decide.
- Learning goal: I want explanations focused on understanding the implementation and learning best practices.
- Feature planning: If a requested feature is large or complex, suggest how to split it into smaller, understandable implementation steps. Explain what each step adds, why it comes first, and how it can be tested before moving on.

When making changes, briefly explain what changed, why it was done that way, and what I should look at if I want to understand the implementation.

## Current Tech Stack

- **Frontend:** React 18, Vite 5, TypeScript, React Router 7, Tailwind CSS 4, shadcn/ui and Radix UI
- **Backend:** Supabase PostgreSQL, Auth, and Storage; Vercel serverless functions in `api/`
- **Book metadata:** Open Library and Google Books (`src/lib/bookLookup.ts`)
- **Barcode scanning:** `@ericblade/quagga2` (`src/components/BarcodeScanner.tsx`)
- **Rich text journals:** Tiptap
- **Tests:** Node's test runner via `tsx`; PGlite for isolated SQL migration tests
- **Hosting:** Vercel

## Local Commands and Configuration

```bash
npm install
npm run dev        # Vite frontend only
npx vercel dev     # Frontend plus local Vercel API functions
npm run build      # TypeScript project build and Vite production build
npm run typecheck  # TypeScript check without output
npm test           # Automated tests, including isolated migration tests
npm run preview    # Preview a production frontend build
```

The browser client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`. Vercel API functions use server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never put the service-role key in a `VITE_` variable. The invite and metadata backfill scripts use `VITE_SUPABASE_URL` plus the service-role key; invites also require `INVITE_REDIRECT_URL`. Database backups use `SUPABASE_DB_URL` and `npm run backup:db`. MCP also needs `READING_JOURNAL_API_ORIGIN`; see `doc/mcp-access.md`.

## Release Process

Before creating a PR, update the user-facing release content for any user-facing and notable change that affects the app.

- Update `src/content/changelog.md` with the new user-facing release note.
- Make sure `src/components/ReleaseNotesDialog.tsx` will surface the new release note to users after deployment.
- Treat this as a required pre-PR step, not a follow-up task.
- If the change is visible to users, include a short note about what they should notice.
- Only add a new changelog entry when the user explicitly asks for one.
- If the user tells to make a PR it should include a summary of all the changes included in the PR.

`src/lib/releaseNotes.ts` parses the Markdown changelog. The dialog opens when the latest version differs from `user_settings.last_seen_release_note_version`. Check this path when a release note is requested.

## Architecture and Where to Look

- `src/lib/router.tsx` defines public and protected routes. `src/components/ProtectedRoute.tsx` checks the session, and `src/components/AppLayout.tsx` provides the signed-in shell.
- `src/pages/` contains route-level pages. `src/components/` contains reusable UI, including `components/ui/` primitives and `components/wrap-ups/` report views.
- `src/context/` and `src/hooks/` manage auth, books, authors, genres, profiles, settings, and shared frontend data. `src/lib/` contains data access and domain calculations; `src/types/` holds shared TypeScript types.
- `api/` contains Vercel functions. `api/app.ts` handles the rewritten `/api/me` and `/api/wrap-ups` routes; `api/_lib/` holds their logic. Other functions serve book, recommendation, and MCP APIs. `vercel.json` contains the rewrites.
- `supabase/schema.sql` describes the base schema for new databases. `supabase/migrations/` contains changes for existing databases and some later features; inspect the relevant migration before changing the database. Do not assume editing SQL files applies them to a live Supabase project.
- `tests/` contains automated tests. Add or run focused tests for behavior and SQL changes, then use `npm run build` for a production check.

## Data and Security Rules

- `books` is the core record. Authors and genres use linked tables (`authors`/`book_authors` and `genres`/`book_genres`); series use `series_id`. Status, current and total pages, rating, favorite flag, dates, language, source, format, ISBN, publication metadata, price, and purchase URL live on the book. Progress percentage is calculated from current and total pages.
- **Book statuses:** `Wishlist` | `To Read` | `Up Next` | `Reading` | `Paused` | `Finished` | `DNF`. Use `src/types/index.ts` and the database constraints as the source of truth. `Unread` and `belongs_to` are old names; the current book property is `source` (`Owned` | `Family` | `Friends` | `Library`).
- Wishlist entries are books with status `Wishlist`, not rows in a separate wishlist table. `useBooksContext().books` contains library books and `wishlistBooks` contains wishes. Keep wishlist books out of library counts and reading analytics unless a feature explicitly includes them. See `doc/wishlist-migration.md`.
- `reading_logs` records page position and optional reading minutes. `book_pause_periods` records pauses. Journal entries are stored in separate book, series, and author journal tables, with related visibility and media tables.
- Profiles, user settings, groups/messages, recommendation data, API keys, and saved `wrap_up_reports` also have dedicated database structures. RLS protects user data; group policies use membership rules. System genres are shared. Check the actual policy when changing access, and explicitly filter by user when using the server's service-role client because it bypasses RLS.
- Browser requests to Supabase use the user's session and RLS. Server routes authenticate either a Supabase web session or a revocable API key; do not treat those credentials as interchangeable (`api/_lib/auth.ts`).
- The app is invite-only. `/login` and `/reset-password` are public; the main app routes require authentication. The server-side invite script is `scripts/invite-user.ts`.

## Current Feature Map

- **Home and library:** `Dashboard`, `Library`, `ExploreLibrary`, and `Wishlist` pages; book detail, journal/annotations, analytics, pause/resume, bulk management, and add-book dialog with ISBN lookup and camera scanning.
- **Collections and journals:** Series, authors, and hierarchical genres have library and detail pages. The library journal combines book, series, and author entries. Journal entries support notes, quotes, reviews, tags, links, and media.
- **Reading data:** `/statistics` shows aggregate analytics; `/reading-history` shows reading history; book and series routes have detail analytics. The reusable calculations live mainly in `src/lib/`.
- **Wrap-ups:** `/wrap-ups` and `/wrap-ups/:monthKey` show monthly saved reports in list or sliding views. `src/lib/wrapUpReports.ts` calculates report data; `api/_lib/wrapUpReports.ts` generates immutable snapshots. See the wrap-up sections in `README.md` and the help page for calculation and missing-data rules. Yearly reports are a schema possibility, not a completed UI feature.
- **Discover and community:** `/discover` has recommendations and series volume suggestions. `/messages` has groups and chat; profiles and settings have their own pages.
- **External access:** `/api/books` and related routes expose authenticated book operations; `/api/mcp` exposes a remote MCP interface using revocable API keys. See `doc/mcp-access.md`.

Use `src/lib/router.tsx`, `src/types/index.ts`, the relevant page or library module, and the matching SQL migration when a feature description here differs from the implementation.
