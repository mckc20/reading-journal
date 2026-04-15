# Feature: Book Detail Analytics Tab (Daily Pages Chart + Reading Log List)

## Problem

The `Analytics` tab in the book detail dialog is currently a stub. Users can log reading progress, but they cannot visually review daily reading output or inspect a history of progress entries in one place.

## Goal

Implement the Analytics tab with:

1. A chart where:
   - Horizontal axis = days
   - Vertical axis = total pages read on that day
2. A list of reading progress entries below the chart

## Confirmed Product Decision

- Include gap days in the chart timeline.
- Days without entries must appear with `0` pages.

## Existing Context

- Reading logs are already stored in `reading_logs`.
- Current helper functions:
  - `createReadingLog(...)`
  - `fetchLastReadingLog(...)`
- Analytics tab currently stubbed in:
  - `src/components/BookDetailModal.tsx`

## Scope

### In Scope

- Fetch all reading logs for the selected book
- Compute daily pages read from log deltas
- Build continuous day range (with zero-filled gaps)
- Render chart in Analytics tab
- Render progress entry list below chart
- Loading, empty, and error states

### Out of Scope

- Export/share analytics
- Cross-book analytics
- Additional chart types (speed trend, cumulative trend, etc.)
- New dependency for charting libraries

## Technical Plan

### 1) Data access (`src/lib/books.ts`)

Add:

- `fetchReadingLogsForBook(bookId: string): Promise<ReadingLog[]>`
  - Query `reading_logs`
  - Filter by `book_id`
  - Sort by `logged_at` ascending
  - Throw on Supabase error

Why ascending:
- Delta calculation (`current - previous`) is deterministic in chronological order.

### 2) Analytics UI component (`src/components/BookAnalyticsPanel.tsx`)

Create a dedicated component to keep `BookDetailModal` clean.

Props:
- `book: Book`

State:
- `logs: ReadingLog[]`
- `loading: boolean`
- `errorMsg: string | null`

Lifecycle:
- On mount and when `book.id` changes, fetch logs.

Derived data:
- Per-log `pagesReadDelta = max(0, current_page - previous_current_page)`
- Group deltas by local calendar day key (`YYYY-MM-DD`)
- Build continuous day range from first log day to last log day
- Fill missing days with `0`
- Produce chart points:
  - `{ dayKey, dayLabel, pagesRead }`

### 3) Chart rendering (no new dependencies)

Implement a lightweight custom chart in the panel:

- Fixed chart area height (around `220px`)
- Vertical bars for each day
- Y scale from `0` to `max(pagesRead)` (safe fallback when max is `0`)
- Day labels on X axis (short format, e.g. `Apr 12`)
- Optional hover/focus tooltip can be deferred if needed

Responsive behavior:
- Works in dialog width on mobile and desktop
- If many days, allow horizontal scrolling inside chart container

### 4) Reading entries list (below chart)

Render entries in reverse chronological order (newest first).

Per row display:
- Logged timestamp
- "Reached page X"
- `+N pages` compared to previous entry
- Optional reading time if present (`reading_time_minutes`)

List container:
- Bounded height with internal scrolling as needed.

### 5) Wire into tab (`src/components/BookDetailModal.tsx`)

- Replace analytics stub inside `TabsContent value="analytics"` with `<BookAnalyticsPanel book={book} />`.

## UX States

### Loading
- Skeleton or muted placeholders for chart + list.

### Empty
- Message: "No reading progress entries yet."
- Short hint: "Log progress in the Properties tab to see analytics."

### Error
- Inline destructive text with retry button (optional).

## Data/Calculation Details

Given ordered logs `L0..Ln` by `logged_at`:

- `delta(L0) = max(0, L0.current_page - 0)` (or clamp to `L0.current_page`)
- `delta(Li) = max(0, Li.current_page - L(i-1).current_page)` for `i > 0`

Group:
- `dailyTotal[day(Li.logged_at)] += delta(Li)`

Gap fill:
- Iterate date by date from first day to last day
- If day missing, set `pagesRead = 0`

Notes:
- Clamping avoids negative bars if historical data is inconsistent.

## Acceptance Criteria

1. Analytics tab no longer shows stub text.
2. Chart displays daily pages read for the selected book.
3. Gap days are visible with `0` pages.
4. Reading log list appears below chart with newest first.
5. Empty state shown when no logs exist.
6. No new charting dependency added.
7. TypeScript passes (`npm run typecheck`).

## Validation Plan

Manual checks:
1. Book with no logs -> empty state.
2. Book with one log -> one day shown, one list entry.
3. Book with logs across non-consecutive dates -> gap days shown at `0`.
4. Multiple logs same day -> bars reflect summed daily deltas.
5. Dialog on mobile width -> chart/list remain usable and readable.

Command:
- `npm run typecheck`

## Risks and Mitigations

- **Timezone/day boundary mismatches**
  Mitigation: Use a consistent local-date formatter for grouping and labels.
- **Large day ranges causing cramped bars**
  Mitigation: horizontal scroll container for chart plot area.
- **Non-monotonic `current_page` data**
  Mitigation: clamp negative deltas to `0`.

## Files Expected to Change

- `src/lib/books.ts` (new fetch helper)
- `src/components/BookAnalyticsPanel.tsx` (new component)
- `src/components/BookDetailModal.tsx` (use new component in Analytics tab)

## Implementation Order

1. Add `fetchReadingLogsForBook` in `src/lib/books.ts`
2. Build `BookAnalyticsPanel` with fetch + derived data
3. Add chart UI
4. Add entries list UI
5. Replace Analytics stub in `BookDetailModal`
6. Run `npm run typecheck`
7. Manual UI verification
