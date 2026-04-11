# Code Review: Fixes & Improvements

A comprehensive code review of the Phase 3 implementation identified 8 bugs and 7 code quality improvements. This document summarizes every change made.

## Bug Fixes

### 1. Rating stars don't update visually after clicking

**Problem:** Rating stars rendered based on the stale `book.rating` prop passed to `BookDetailModal`. Clicking a star called `onUpdated()` which updated the books array in context, but the `book` prop held by the parent's `selectedBook` state was never refreshed — so the stars appeared unchanged until the modal was closed and reopened.

**Fix:** Added `localRating` state (mirroring the existing `isFavorite` pattern) that updates immediately on click. Also enables clearing a rating by clicking the same star again.

**Files:** `src/components/BookDetailModal.tsx`

---

### 2. Header badge shows stale status

**Problem:** The status badge in the modal header used `book.status` (stale prop) instead of the form's watched `status` value. Changing the status dropdown had no visible effect on the badge.

**Fix:** Replaced `book.status` with the already-watched `status` form variable in both the badge text and variant calculation.

**Files:** `src/components/BookDetailModal.tsx`

---

### 3. Progress inputs hidden when total pages not set

**Problem:** The "Update progress" section in BookDetailModal was conditionally rendered with `{book.total_pages && (...)}`, which hid the current page input entirely when a "Reading" book had no `total_pages` set. Users couldn't enter any progress at all.

**Fix:** Removed the `book.total_pages` / `book.total_chapters` guards. Progress inputs now always appear when status is "Reading", with an optional "/ total" suffix shown only when the total is known.

**Files:** `src/components/BookDetailModal.tsx`

---

### 4. Save and delete errors silently swallowed

**Problem:** `onSubmit` and `handleDelete` in BookDetailModal used `try/finally` with no `catch` block. If `onUpdated` or `onDeleted` threw, the error was an unhandled rejection and the user saw no feedback.

**Fix:** Added `catch` blocks that set an `errorMsg` state displayed in the modal footer. Also added error rollback to `toggleFavorite` — the optimistic `setIsFavorite` is now reverted if the update fails.

**Files:** `src/components/BookDetailModal.tsx`

---

### 5. Select dropdowns can't be cleared

**Problem:** Radix Select doesn't support empty string as a value. Once a Language, Format, Belongs To, or Series was selected, there was no way to unset it.

**Fix:** Added a "Not set" (or "None" for Series) option with a `__none__` sentinel value to every clearable Select, mapped back to empty string in the form state. Applied to both `AddBookDialog` and `BookDetailModal`.

**Files:** `src/components/AddBookDialog.tsx`, `src/components/BookDetailModal.tsx`

---

### 6. Login redirect race condition

**Problem:** After successful sign-in, two competing redirects could fire: the `useEffect` (which always navigated to `/`) and the `onSubmit` handler (which correctly used `location.state.from`). If the Supabase auth listener updated the user state before `onSubmit`'s navigate executed, the user always landed on `/` instead of their intended page.

**Fix:** The `useEffect` now reads `location.state.from`, and `onSubmit` delegates redirect entirely to the `useEffect` — eliminating the race.

**Files:** `src/pages/Login.tsx`

---

### 7. useSeries silently swallows fetch errors

**Problem:** `useSeries` caught fetch errors with `.catch(() => {})`, giving users no indication when series failed to load (the dropdown just appeared empty).

**Fix:** Added an `error` state to the hook that captures and exposes fetch failures for consumers to display.

**Files:** `src/hooks/useSeries.ts`

---

### 8. Cover upload accepts any file type

**Problem:** `uploadCover` extracted the file extension from the filename without validation. While the HTML input's `accept="image/*"` provides a hint, it's not enforced.

**Fix:** Added validation against a whitelist of image extensions (`jpg`, `jpeg`, `png`, `webp`, `avif`) before uploading to Supabase Storage.

**Files:** `src/lib/books.ts`

---

## Code Quality Improvements

### 9. Extract duplicated `statusVariant` function

`statusVariant` was defined identically in `BookCard.tsx` and `BookDetailModal.tsx`. Moved to `src/lib/utils.ts` and imported from both components.

**Files:** `src/lib/utils.ts`, `src/components/BookCard.tsx`, `src/components/BookDetailModal.tsx`

---

### 10. Display error state in Dashboard and Library

`useBooks` tracked an `error` state, but neither `Dashboard` nor `Library` read or displayed it. A failed `fetchBooks()` resulted in infinite loading skeletons or a silent empty state. Added error banners with a "Try again" button that calls `reload()`.

**Files:** `src/pages/Dashboard.tsx`, `src/pages/Library.tsx`

---

### 11. Current page/chapter inputs in Add Book dialog

When adding a book with status "Reading", there was no way to set the current page or chapter — users had to create the book and then immediately edit it. Now shows current page/chapter inputs when status is "Reading".

**Files:** `src/components/AddBookDialog.tsx`

---

### 12. Standalone typecheck script

Vite only transpiles TypeScript without checking types. Added `npm run typecheck` (`tsc --noEmit`) so developers can catch type errors during development without running a full production build.

**Files:** `package.json`
