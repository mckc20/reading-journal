# Issue #10 -- Book Card Top Corners

## Problem

A blank gap appeared above the book cover image inside the book card. The cover
image did not extend to the top edge of the card, leaving visible padding between
the card's top border and the image.

## Root Cause

The shadcn `Card` component applies `py-4` (1rem vertical padding) by default.
It includes a conditional `has-[>img:first-child]:pt-0` rule that removes top
padding when the first child is a direct `<img>` element, but in `BookCard.tsx`
the first child is a `<div>` wrapper (the cover container), not a bare `<img>`.
This meant the top padding was never removed, creating the gap.

## Fix

Added `pt-0` to the `Card` className in `src/components/BookCard.tsx` to
explicitly remove the top padding. The card already had `overflow-hidden`, so the
cover image is correctly clipped by the card's rounded top corners.

### Changed file

- `src/components/BookCard.tsx` -- added `pt-0` class to the `<Card>` element.
