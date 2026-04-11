# Phase 3: Core CRUD

## What was built

### Data layer (`src/lib/books.ts`)
All Supabase queries live in one file with no React dependencies — pure async functions that throw on error. Keeping this separate from hooks makes the query logic testable in isolation and avoids re-creating closures on every render.

Functions: `fetchBooks`, `createBook`, `updateBook`, `deleteBook`, `uploadCover`, `deleteCover`, `fetchSeries`, `createSeries`.

**Important:** `user_id` must be provided explicitly on every INSERT. The schema declares `user_id NOT NULL` with no `DEFAULT`, and the RLS `INSERT` policy enforces `auth.uid() = user_id` — it checks the value but does not set it. Omitting `user_id` causes the query to fail with a not-null constraint violation before RLS even runs. `user_id` is read from `useAuth().user.id` inside the hook layer, never from the form.

### State hooks (`src/hooks/`)

**`useBooks.ts`** — manages the `books` array, `loading`, and `error` state. Exposes `addBook`, `updateBook`, `deleteBook`. Optimistic updates via local state mutation (no full refetch on every change — this is a personal app with one user).

`addBook` flow: generates a `bookId` client-side with `crypto.randomUUID()` before any network call, uploads the cover to `covers/{userId}/{bookId}.{ext}` if a file is provided, then inserts the book with that same `id`. The client-generated `id` makes the Storage path and DB row share the same UUID without a round-trip.

**`useSeries.ts`** — lighter hook: fetches the series list once on mount, exposes `addSeries` which appends inline and returns the new row so `AddBookDialog` can immediately select it.

### Shared state (`src/context/BooksContext.tsx`)
Wraps `useBooks` in a React context so both `Dashboard` and `Library` pages share the same books array without prop drilling. `AppLayout` is the provider; pages consume via `useBooksContext()`.

### App layout (`src/components/AppLayout.tsx`)
Renders `<BooksProvider><Outlet /></BooksProvider>`, a sticky top header, and a fixed mobile bottom nav. Nav links use `useLocation().pathname` for active state. The `+` button and sign-out button live in the header.

Router structure after Phase 3:
```
/login                   → Login (public)
<ProtectedRoute>
  <AppLayout>            → BooksProvider + nav
    /                    → Dashboard
    /library             → Library
*                        → 404 (outside protected wrapper)
```

### Book card (`src/components/BookCard.tsx`)
Displays cover (or a `BookOpen` placeholder), title, author, status badge, a reading progress bar (`<Progress>`) when `status === "Reading"` and page counts are set, and a heart icon overlay for favorites. Clicking anywhere opens the Detail Modal.

### Add Book dialog (`src/components/AddBookDialog.tsx`)
Opens from the `+` button in the header. All fields from the `books` schema are present; conditional visibility is driven by `watch('status')`:
- `date_started` shown for Reading / Finished / DNF
- `date_finished` shown for Finished / DNF
- `volume_number` shown only when a series is selected

Shadcn's `Select` (Radix-based) is not compatible with react-hook-form's `register()` — it requires `Controller`. All `Select` fields use `Controller`; plain text `Input` fields use `register`.

The series selector includes a "Add new series…" option that reveals an inline `Input + Button` without opening a separate dialog. On confirm, `addSeries()` creates the row and immediately sets the form value to the new series id.

Cover upload renders a styled `<label>` with a live `URL.createObjectURL()` preview. The object URL is revoked on unmount.

### Book detail modal (`src/components/BookDetailModal.tsx`)
Three tabs: **Properties** (editable), **Journal** (Phase 4 stub), **Analytics** (Phase 5 stub).

The form is re-initialized via `reset()` whenever the `book` prop changes. On save, only dirty fields are sent (`formState.dirtyFields`) — unchanged values are never written back to Supabase.

Delete uses a confirm-on-second-click pattern: first click changes the label to "Are you sure?", second click executes. This avoids a separate confirmation dialog.

**Layout note:** The footer buttons are in a plain `<div>`, not `<DialogFooter>`. `DialogFooter` from this shadcn version has `-mx-4 -mb-4` hardcoded — those negative margins are designed for a direct child of `DialogContent`. Three flex levels deep, they pull the footer out of the normal flow and cause it to overlap the scrollable content above.

**Scroll note:** The `ScrollArea` inside the form requires `min-h-0` on the `form` element to actually scroll. Without it, CSS flexbox's default `min-height: auto` prevents the form from shrinking, so the scroll container expands to fit all content and never activates.

### Pages

**`src/pages/Dashboard.tsx`** — filters books client-side into "Currently Reading" (`status === "Reading"`) and "Up Next" (`status === "Up Next"`) sections. Shows skeleton cards while loading, an empty state with usage hint when both sections are empty.

**`src/pages/Library.tsx`** — three `<Tabs>` views:
- **All Books** — full grid, newest first
- **TBR** — Wishlist + Not Started + Up Next, with count in the tab trigger
- **Series** — groups books by `series_id`, sorted by `volume_number`; standalone books (no series) appear in a separate "Standalone" group

## Bugs fixed during phase

**`Input` missing `forwardRef`** — The installed shadcn `Input` was a plain function component. React 18 requires `forwardRef` for a component to forward a `ref` prop to its underlying DOM element. Without it, react-hook-form's `register()` ref callback is silently dropped; RHF marks the field as unmounted and required validation always fails despite visible values in the inputs. Fixed by wrapping `Input` in `React.forwardRef`.

**`user_id` missing from INSERT payloads** — Both `createBook` and `createSeries` were omitting `user_id`. Because the schema has `user_id NOT NULL` with no default and RLS requires `auth.uid() = user_id`, every insert was rejected. Fixed by updating `BookInsert` to include `user_id` and passing `user.id` from the hook layer. `AddBookPayload` (the form-facing type) continues to omit it.

**Supabase errors swallowed as "Failed to add book"** — `PostgrestError` and `StorageError` from Supabase are not `instanceof Error`. The catch block only checked `instanceof Error`, so real error messages were never surfaced. Fixed by also checking for an object with a `.message` property.

## Supabase Storage setup (manual)

The `covers` bucket must be created manually in the Supabase dashboard before cover uploads work. Books without a cover are shown with a placeholder and can have a cover added later via the detail modal.

1. Supabase Dashboard → Storage → **New bucket**
2. Name: `covers`, Public: **yes** (cover URLs are used directly in `<img src>` — no signed URLs)
3. Add a Storage policy: allow INSERT and DELETE for authenticated users scoped to their own folder (`covers/{user_id}/...`)

## New shadcn components added

`textarea`, `separator`, `scroll-area`, `progress` — installed via `npx shadcn@latest add`.

## Key files

| File | Purpose |
|---|---|
| `src/lib/books.ts` | All Supabase queries for books, series, and cover Storage |
| `src/hooks/useBooks.ts` | Books state + CRUD actions; `AddBookPayload` type |
| `src/hooks/useSeries.ts` | Series list + `addSeries` action |
| `src/context/BooksContext.tsx` | Shared books state provider; `useBooksContext` hook |
| `src/components/AppLayout.tsx` | Sticky header, mobile bottom nav, `BooksProvider`, `AddBookDialog` trigger |
| `src/components/BookCard.tsx` | Book card: cover, title, author, status badge, progress bar |
| `src/components/AddBookDialog.tsx` | Add Book form with cover upload and inline series creation |
| `src/components/BookDetailModal.tsx` | Tabbed detail/edit modal with dirty-only save and confirm-delete |
| `src/pages/Dashboard.tsx` | Currently Reading + Up Next sections |
| `src/pages/Library.tsx` | All Books / TBR / Series tabs |
| `src/components/ui/input.tsx` | Fixed: added `React.forwardRef` so react-hook-form refs attach correctly |

## Before starting Phase 4

- [ ] Create the `covers` Storage bucket in Supabase (see setup above)
- [ ] Journal tab in `BookDetailModal` is a stub — Phase 4 adds a rich text area, guide questions, and quotes
- [ ] Daily reading log UI (current page + time spent) goes into the detail modal in Phase 4
- [ ] Barcode scanner + ISBN → Google Books / Open Library auto-fill goes into `AddBookDialog` in Phase 4
