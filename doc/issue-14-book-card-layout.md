# Issue #14 — Inconsistent Book Card Layout in Library View

## Problem

Book cards in the Library grid appeared distorted and inconsistent in size.
When cards with different content lengths (title, author) shared a grid row,
CSS Grid's default `align-items: stretch` forced them to the same height.
Because the `Card` component uses `flex flex-col`, the extra height was
distributed to flex children — stretching the cover image container beyond
its intended 2:3 aspect ratio.

The Dashboard was less affected because books in the same section
("Currently Reading", "Up Next") tend to have similar content lengths.

## Fix

Two Tailwind classes added to `BookCard.tsx`:

| Element          | Class added      | Purpose                                              |
|------------------|------------------|------------------------------------------------------|
| Cover container  | `flex-shrink-0`  | Prevents the aspect-ratio div from growing/shrinking |
| `CardContent`    | `flex-1`         | Absorbs any extra row height in the text area        |

This keeps cover images at a uniform 2:3 size across all cards in a row,
with the content area stretching instead when grid rows are taller than
a card's natural height.

## Files Changed

- `src/components/BookCard.tsx` — cover div and CardContent class updates
