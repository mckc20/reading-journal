# Reading Journal Web App

## 📖 Project Overview
The Reading Journal Web App is a dedicated platform designed to store, document, and track books and reading progress. It features advanced capabilities like automated barcode scanning, precise reading time tracking, custom data visualizations, and multi-user support.

## 🛠️ Technology Stack
- **Frontend Framework:** React (via Vite)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Backend & Database:** Supabase (PostgreSQL, Authentication, Storage)
- **Hosting:** Vercel (Frontend)
- **External APIs:** Google Books API / Open Library API (for ISBN fetching)
- **Barcode Scanning:** `html5-qrcode` (or similar browser-based camera library)

## 📱 Platform & Compatibility
The app is designed to be fully usable on **mobile and tablet browsers**, in addition to desktop. All UI layouts must be responsive, with touch-friendly interactions. The barcode scanner feature is primarily intended for mobile use (device camera access).

## 🤖 AI agent access

Codex and Claude Code can connect to Reading Journal through its remote MCP endpoint. See [MCP access for AI agents](doc/mcp-access.md) for secure setup, local development, and key revocation.

## 🚀 Core Features & Requirements

### 1. Authentication & Multi-User Support
- **Initial Page:** A welcoming landing page explaining what the "Reading Journal" is, featuring introductory text and preview images.
- **Auth Flow:** Log In button only. Public sign-ups are disabled — new users are added via invite only.
- **Invite-Only Access:** Sign-ups are disabled in the Supabase dashboard. New users are invited via the Supabase Admin API (`supabase.auth.admin.inviteUserByEmail()`), called from a server-side script or Supabase Edge Function using the service role key.
- **Multi-Account Support:** Handled securely via Supabase Authentication (Email/Password). Each user's data will be isolated in the Supabase PostgreSQL database using Row Level Security (RLS).

### 2. Dashboard (Start Page)
- **Currently Reading & Recently Finished:** Quick access to active and recently completed books, displayed as cards.
- **Insights Block:** A dynamic dashboard section displaying personalized reading stats (detailed in Section 9).
- **Navigation:** Easy access to all library views.
- **Interactivity:** Clicking a book card opens a detailed pop-up/modal with properties and journal content.

### 3. Book Properties & Data Structure
Each book entity must support the following properties:
- **Basic Information:**
  - Cover Image (stored in Supabase Storage)
  - Author
  - Genre
  - Status: `Wishlist`, `Unread`, `Up Next`, `Reading`, `Finished`, `DNF` (Did Not Finish)
  - Progress: Visual percentage bar calculated from current/total pages
  - Rating: 1-5 stars (with an exclusive "Heart" toggle for all-time favorites)
  - Current Page / Total Pages
  - Current Chapter / Total Chapters
  - Date Started & Date Finished
- **Details:**
  - Language: `German`, `Spanish`, `English`
  - Belongs to: `Me`, `Family`, `Friends`, `Library`
  - Format: `eBook`, `Audiobook`, `Paperback`, `Hardcover`
- **Series Info (Conditional):**
  - Series Name
  - Volume/Entry Number

### 4. Content & Journaling
Beneath the properties section on a book's detail page, there are two distinct tabs:
- **Journal Tab:** - Rich text area for personal reviews and analyses.
  - Includes pre-defined "Guide Questions" to prompt thoughtful reviews.
  - Dedicated space for logging "Favorite Quotes".
- **Analytics Tab:** - Visual graphs and charts specific to the individual book's reading history.

### 5. Advanced Tracking (Pages & Time)
- **Daily Page Logging:** Users can log their current page/chapter every day. The database will store the timestamp, page, and chapter to generate pacing graphs.
- **Time Tracking:** When updating the current page, users have the option to manually enter the time spent reading (e.g., "45 mins"). This data is used to calculate reading speed and total hours read.

### 6. Adding New Books
- **Manual Entry:** Standard form to fill out book properties.
- **Barcode/ISBN Scanner:** Uses the device's camera to scan the barcode on the back of a physical book.
  - The app pings a public API (Google Books/Open Library) to auto-fill the cover, author, total pages, and genre.
  - If the API data implies a series, the app will prompt the user: *"Link to existing series?"* via a dropdown menu.

### 7. Library Views & Navigation
The app features multiple ways to visualize and filter the database:
- **Library:** Sortable list (e.g., Favorites, Finished, All Books).
- **Series Library:** Grouped by series.
- **To Be Read (TBR):** Filtered view of unread books.
- **Timeline:** A Gantt-style calendar with bars marking the start and end dates of each book. Includes a "Through Time" tab grouping read books by month.
- **Authors:** Grouped by author.
- **Genres:** Grouped by genre.
- **Languages:** Grouped by language.

### 8. Series Management
- **Series Cards:** Clicking a series card opens a detailed view.
- **Series Content:** Shows overarching series properties

Beneath the properties section on a series's detail page, there are two distinct tabs:
- **Journal Tab:** - Rich text area for personal reviews and analyses.
  - Includes pre-defined "Guide Questions" to prompt thoughtful reviews.
  - Dedicated space for logging "Favorite Quotes".
- **Analytics Tab:** - Visual graphs and charts specific to the individual series's reading history.

a space for a series review, and a chronological list of all books belonging to that series, visually distinguishing between "Read" and "Unread" entries.

### 9. Insights & Analytics
Data visualizations displayed on the Start Page and dedicated wrap-ups:
- **Ongoing Insights (Dashboard):**
  - *Pacing Predictor:* Estimated completion date for current reads based on average pages-per-day.
  - *Format & Genre Breakdown:* Donut chart for the current month's trends.
  - *Average Reading Speed:* Calculated pages read per hour.
- **Monthly Summary:** Auto-generated wrap-up at the end of each month showing books finished and total pages/hours.
- **Yearly Wrap-Up:**
  - Top favorite books, authors, and genres.
  - Reading habit analytics (e.g., "You read mostly on Sunday mornings").
  - Total hours read and pages turned.

### Wrap-up report foundation (phase 1)

Monthly calculations live in `src/lib/wrapUpReports.ts`; trusted backend generation lives in `api/_lib/wrapUpReports.ts`. Archive access is described below; emails and automatic scheduling remain later phases.

- Apply `supabase/migrations/20261016_wrap_up_reports.sql` to an existing database before using generation. The canonical schema includes the same table for fresh installations.
- `generateMonthlyReport(userId, "YYYY-MM")` accepts completed months only. It requires the existing server-only Supabase URL and service-role key. It returns the saved report on repeated or overlapping calls, without updating its contents.
- Calendar boundaries and reading days use the profile's IANA timezone. Missing or invalid timezones fall back to UTC, with that fallback recorded. Start timestamps are inclusive and end timestamps exclusive; book completion dates are calendar dates.
- Finished books come from valid completion dates, independently of logs or current status. Missing completion dates cannot be assigned to a month. Historical reports reflect records available at generation time and cannot reconstruct earlier edits.
- Pages logged share the dashboard's calculation: the first log counts from zero, later logs count only increases beyond the highest earlier page. Earlier logs establish the baseline even outside the report month. Corrections add zero and repeated pages are not counted twice. A first log can include reading done before it was recorded.
- Reading minutes are summed only when explicitly recorded, including zero. Audiobooks use recorded minutes and page positions without converting listening time into pages. Reading days require positive page progress or positive minutes.
- Logged totals are observations, not estimates of all reading. No logs means unavailable (`null`), not zero reading. Coverage records missing minutes, invalid dates, and finished books without period logs. Partially recorded minutes remain a sum of the available observations.
- `activeBooks` means books with positive logged activity in the month and no recorded completion by month-end. It does not claim a confirmed historical status. Unsupported highlights are omitted; previous-month comparisons use source records without generating another saved report.
- Snapshots preserve metadata and ratings even after source records change or disappear. Cover URLs are saved, but the image files themselves are not copied. Reports generated later than the immediately preceding month are marked historical.
- RLS permits users to read only their own reports and prevents client writes. Backend queries explicitly filter ownership because service-role credentials bypass RLS. Generation reads sources in pages; source reads are not a transaction, so avoid intentionally editing records during a generation run when validating exact fixtures.

### Monthly wrap-up archive (phase 2)

- The **Wrap-Ups** three-dot menu offers Sliding view and List view on every screen size, including open reports. The explicit choice is saved per account in browser storage; without a preference, desktop (768px+) defaults to Sliding view and mobile to List view. Sliding view opens the previous completed month automatically, falling back to the newest available month. Centered arrows browse available months; selecting the month heading opens separate month/year selectors. Selection uses stable `/wrap-ups/YYYY-MM` links with browser Back/Forward support. List view groups months by year and opens reports with plain month headings outside the stats box. History starts at the earliest valid book start/finish date, book-added timestamp, reading log, or journal entry date. Gaps remain available; months before that history do not appear. Existing saved reports remain accessible after source records are deleted.
- `/wrap-ups/YYYY-MM` is a private, stable detail link. Signed-out visitors return to that month after signing in. Opening an unsaved month creates one immutable snapshot; revisiting it returns the saved report. This flow sends no email.
- Session-authenticated endpoints are `GET /api/wrap-ups` (archive metadata), `GET /api/wrap-ups/:monthKey` (saved report), and `POST /api/wrap-ups/:monthKey` (generate or return an existing report). The backend derives the user from the session, ignores caller-supplied ownership, and rejects generation outside supported completed history. Responses are private and are not cached.
- Vercel rewrites `/api/me` and the wrap-up endpoints to the shared `api/app.ts` entry point, keeping the deployment at the Hobby plan's 12-function limit. Handlers live under `api/_lib` so they are not deployed as separate functions. Public URLs and each handler's authentication stay unchanged.
- New version 1 snapshots include an optional `dailyActivity` series with local dates, pages logged, and minutes logged. The chart displays every calendar day; dates without logs have no bar and are labeled as missing observations, while explicit zero remains zero. Missing time stays unavailable. Older snapshots are displayed unchanged, with an explanation instead of a reconstructed chart. Previous-month comparisons continue to use source records at generation time without saving another report.
- New snapshots also save `otherBookActivity`: per-book logged pages/time, log counts, and journal entry text grouped by `entry_date`. This includes journal-only activity and excludes books finished in that month because they appear in the finished-books section. Journal entries do not increase reading totals or reading days. Older snapshots keep their original book list and explain that detailed context was not saved; they are never enriched from live records.
- The finished-books section adapts at 768px: one book shows its title, author, rating, saved dates and logged activity beside the cover; 2–4 books on desktop and 2 on mobile use the grid. Larger collections match the Library shelves, with compact covers, hidden scrollbars and overlaid arrows that appear when scrolling is possible, plus swipe and keyboard navigation. New snapshots include optional `finishedBookActivity`; older reports use saved book dates without fetching live data.
- “Highest rated book” prioritizes favorite books over non-favorites, then uses star ratings and a stable ID tie-break. New snapshots capture book favorite flags; existing saved highlights remain unchanged. Comparison headings link directly to the previous month’s private report.
- Sliding view immediately slides the outgoing and incoming headings and reports in the direction of navigation, while arrows remain fixed. If the next report is still loading, a spinner slides in and is replaced by the report when ready; reduced-motion preferences disable the animation.
- Settings links to the protected `/help` overview. Its `/help/wrap-ups` guide explains wrap-up sections, saving, calculations, timezones and missing data. These explanations live in Help rather than footnotes on the wrap-up pages.
- Apply the phase 1 reports migration before deployment. No additional database migration is needed for phase 2 because the daily series is stored inside the existing JSON snapshot. Backend generation requires the existing server-only Supabase credentials; never expose the service-role key through a `VITE_` variable.
- Use `vercel dev` for local checks involving the API routes; `npm run dev` serves the frontend only. Verify opening and revisiting a supported month, returning through login from a detail link, sparse/no-log reports, broken covers, and deleted-book links at desktop and mobile widths. Automated archive, ownership, API, concurrency, and daily-series checks run with `npm test`; `npm run build` checks both frontend and backend TypeScript.

### Supabase Configuration

#### Database Schema

Run `supabase/schema.sql` in the Supabase SQL Editor (Dashboard > SQL Editor > New query) to create all tables, indexes, and RLS policies.

#### Storage: `covers` Bucket

Cover images are stored in Supabase Storage. The bucket must be created manually:

1. **Dashboard > Storage > New bucket**
   - Name: `covers`
   - Public: **yes** (cover URLs are used directly in `<img src>` tags, no signed URLs needed)

2. **Add RLS policies** — run in the SQL Editor:

```sql
-- Allow authenticated users to read covers in their own folder
CREATE POLICY "covers: owner select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to upload covers to their own folder
CREATE POLICY "covers: owner insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update (upsert) their own covers
CREATE POLICY "covers: owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own covers
CREATE POLICY "covers: owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

The upload path format is `{user_id}/{book_id}.{ext}` (within the `covers` bucket), so these policies ensure users can only access their own folder. All four policies (SELECT, INSERT, UPDATE, DELETE) are required — SELECT and UPDATE are needed for the upsert logic used during cover uploads.

#### Environment Variables

Create a `.env` file in the project root with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Password reset emails

The login page sends password reset emails through Supabase Auth. In Supabase Dashboard → **Authentication** → **URL Configuration**, add the URLs that may receive reset links:

- `http://localhost:5173/reset-password` for local development
- `https://my-reading-journal.vercel.app/reset-password` for production

Supabase requires an email provider to deliver reset links. Its built-in sender is suitable for testing but rate-limited; configure custom SMTP before relying on reset emails in production.

#### Manual Database Backup (Schema + Data)

You can create a local SQL backup (structure + data) from the project root:

```bash
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project-ref.supabase.co:5432/postgres npm run backup:db
```

Prerequisites:
- provide the Postgres connection string as `SUPABASE_DB_URL` (or pass it as first argument)
- `pg_dump` is installed and available in your `PATH`

The script creates both files in `backups/db/` using your local timestamp in `YYYY-MM-DD-HH-MM` format:
- `structure-YYYY-MM-DD-HH-MM.sql`
- `data-YYYY-MM-DD-HH-MM.sql`

Example output files:
- `backups/db/structure-2026-04-19-14-30.sql`
- `backups/db/data-2026-04-19-14-30.sql`

Credentials are read from runtime input/environment only. Do not commit real connection strings.

---
*Generated for coding agent context based on the user's Reading Journal UI/UX specifications and technical requirements.*
