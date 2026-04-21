Login covers are selected from a predefined list in `src/pages/Login.tsx`.

Behavior:

- Cover changes every 10 seconds
- Transition uses a fade animation
- The same cover never appears twice in a row
- Portrait images are only shown on mobile (`max-width: 767px`)
- Bottom-left location text is sourced from Unsplash metadata and hidden when unavailable

Current supported cover ids are defined in `LOGIN_COVERS` inside `src/pages/Login.tsx`.

To replace a cover, keep the same id and save one of these filenames:

- `<id>.webp` (preferred)
- `<id>.jpg`
- `<id>.jpeg`
- `<id>.png`

For each id, the login page loads the first available format in this order:

1. webp
2. jpg
3. jpeg
4. png
