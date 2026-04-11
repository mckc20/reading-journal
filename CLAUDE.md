# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal reading journal web app for tracking books, reading progress, and analytics. Multi-user, with data isolation per user via Supabase RLS.

## Tech Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **External APIs:** Google Books API / Open Library API (ISBN lookups)
- **Barcode Scanning:** `html5-qrcode`
- **Hosting:** Vercel

## Commands

Once initialized (Phase 1):

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run preview   # Preview production build
```

Environment variables go in `.env` — Supabase URL and anon key from the Supabase dashboard.

## Architecture

### Database Schema (Supabase/PostgreSQL)

**`books`** — core entity: title, author, genre, status, cover_url (Supabase Storage), rating (1–5), is_favorite (heart toggle), current_page, total_pages, current_chapter, total_chapters, date_started, date_finished, language, belongs_to, format, series_id, volume_number, user_id

**`series`** — series name, overarching properties, journal content, user_id

**`reading_logs`** — timestamp, book_id, current_page, reading_time_minutes, user_id

All tables use Row Level Security so queries are automatically scoped to `auth.uid()`.

### Key Domain Values

- **Status:** `Wishlist` | `Not Started` | `Up Next` | `Reading` | `Finished` | `DNF`
- **Language:** `German` | `Spanish` | `English`
- **Belongs to:** `Me` | `Family` | `Friends` | `Library`
- **Format:** `eBook` | `Audiobook` | `Paperback` | `Hardcover`
- **Progress:** calculated as `current_page / total_pages` percentage

### Planned `src/` Structure

```
src/
  components/   # Reusable UI (cards, modals, forms, charts)
  pages/        # Route-level components (Dashboard, Library, Timeline, etc.)
  lib/          # Supabase client, API helpers (Google Books, Open Library)
  hooks/        # Custom React hooks
  context/      # Auth context
  types/        # Shared TypeScript types
```

### Key Features & Where They Live

- **Dashboard** — currently reading cards, insights block (pacing predictor, genre donut chart, reading speed)
- **Book detail modal** — properties tab, journal tab (rich text + guide questions + quotes), analytics tab (per-book reading history charts)
- **Add Book** — manual form or barcode/ISBN scanner → auto-fill via Books API → optional series link prompt
- **Library views** — All Books, TBR, Series Library, Timeline (Gantt), Authors, Genres, Languages
- **Series detail** — same tab structure as book detail (journal + analytics)
- **Analytics** — pacing predictor from `reading_logs`, monthly summaries, yearly wrap-up

### Auth

Protected routing: unauthenticated users see only the landing/auth pages. Supabase Auth handles email/password sign-up and login.
