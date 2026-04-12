# Feature: Reading Progress Logging with iOS-Style Scroll Picker

## Problem

The book detail dialog had a basic number input for updating the current page. There was no way to log reading sessions (page reached + time spent), and the UX felt utilitarian rather than tactile. The `reading_logs` table existed in the database but had no frontend integration.

## Solution

### iOS-style scroll wheel picker (`src/components/ui/scroll-wheel-picker.tsx`)

A reusable vertical scroll picker component inspired by the iOS alarm clock picker:

- Uses CSS `scroll-snap-type: y mandatory` for native-feeling snap behavior
- Items fade in opacity based on distance from the selection center
- Gradient overlays at top and bottom create the characteristic fade effect
- Horizontal border lines mark the selected item
- Scrollbar is hidden; touch scrolling with momentum works natively
- `overscrollBehavior: contain` prevents parent scroll interference

### Reading progress panel (`src/components/ReadingProgressPanel.tsx`)

Self-contained component replacing the old number input, with two states:

**Collapsed:** Shows current progress ("Page X of Y") and an "Update progress" button.

**Expanded:** Three scroll wheel pickers:
- **Page picker** -- range from last logged page + 1 to total pages. For books with >200 pages, steps by 5; for >1000 pages, steps by 10. Always includes the first and last page.
- **Hours picker** -- 0h to 6h
- **Minutes picker** -- 00m to 55m in 5-minute increments

On save:
1. Creates a `reading_log` entry in Supabase (page + optional time)
2. Updates the book's `current_page` via the parent callback
3. Collapses back and updates the minimum page for the next log

### Supabase functions (`src/lib/books.ts`)

- `createReadingLog(bookId, userId, currentPage, readingTimeMinutes?)` -- inserts into the `reading_logs` table
- `fetchLastReadingLog(bookId)` -- fetches the most recent log to determine the minimum page value

### BookDetailModal changes (`src/components/BookDetailModal.tsx`)

- Replaced the old `current_page` number input (lines 305-327) with `<ReadingProgressPanel>`
- Removed `current_page` from the react-hook-form since it's now managed exclusively through the reading log flow
- The panel is decoupled from the main form save -- it has its own Save/Cancel buttons

## Database

Uses the existing `reading_logs` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Auto-generated |
| `book_id` | uuid | FK to books |
| `user_id` | uuid | FK to auth.users, scoped via RLS |
| `current_page` | integer | Page reached in this session |
| `reading_time_minutes` | integer | Optional, must be positive |
| `logged_at` | timestamptz | Auto-set to now() |
