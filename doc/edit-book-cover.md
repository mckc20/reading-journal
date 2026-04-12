# Feature: Edit Book Cover in Detail Dialog

## Problem

Once a cover was set for a book, there was no way to change it without deleting and re-adding the book. The cover thumbnail in the book detail dialog was display-only.

## Solution

### Cover editing UI (`BookDetailModal.tsx`)

- The cover thumbnail in the dialog header is now a clickable `<label>` wrapping a hidden file input (`accept="image/*"`)
- On hover, a semi-transparent overlay appears with an `ImagePlus` icon (or a spinner during upload)
- Selecting a file triggers an immediate upload (same instant-feedback pattern as favorite/rating toggles)
- Works for both adding a first cover and replacing an existing one

### Cover update logic (`useBooks.ts`)

Added `updateCover(id, file)` which:

1. Deletes all old cover files from the `covers` storage bucket (best-effort, tries all valid extensions)
2. Uploads the new file via `uploadCover()` with `upsert: true`
3. Updates the book's `cover_url` in the database
4. Updates local state so all views reflect the change

### Stale `selectedBook` bug fix (`Library.tsx`, `Dashboard.tsx`)

Both pages stored `selectedBook` as a `useState<Book | null>` snapshot captured on click. When `updateCover` (or any update) modified the `books` array in context, the dialog still displayed the stale snapshot.

**Fix:** Store only `selectedBookId` and derive the book object from the live `books` array:

```tsx
const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
const selectedBook = selectedBookId
  ? books.find((b) => b.id === selectedBookId) ?? null
  : null;
```

This ensures the dialog always reflects the latest book state for all updates — not just covers, but also favorites, ratings, and form saves.
