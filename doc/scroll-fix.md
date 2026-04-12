# Fix: Book Detail Dialog Scroll

## Problem

The book detail dialog's Properties tab was not scrollable. When the form content exceeded the dialog's `max-h-[90svh]` constraint, fields below the fold (Belongs to, Total pages, Date started, Series) were clipped and unreachable.

## Root Cause

Two issues combined to break the scroll:

### 1. Broken flex height chain at `TabsContent`

`TabsContent` had `flex-1 min-h-0` making it a flex **item**, but it was not itself a flex **container**. The inner `<form>` used `h-full` (percentage-based height), which cannot resolve against a parent whose height is determined by flex layout rather than an explicit `height` property.

### 2. Radix ScrollArea viewport ignoring parent height

The ScrollArea component's viewport used `size-full` (`width: 100%; height: 100%`). CSS percentage heights do not resolve against flex-computed parent heights — the viewport expanded to its full content size (860px) instead of being constrained to the root's flex-computed height (571px). With no height difference between viewport and content, there was nothing to scroll.

## Fix

### `src/components/BookDetailModal.tsx`

- Added `flex flex-col` to `TabsContent` so it becomes a flex container
- Changed the form from `h-full` to `flex-1` for flex-based sizing instead of percentage-based

### `src/components/ui/scroll-area.tsx`

- Made the ScrollArea root a flex container (`flex flex-col`) so the viewport can use flex-based sizing
- Changed the viewport from `size-full` to `w-full flex-1 min-h-0`, replacing the broken `height: 100%` with flex grow/shrink behavior

Both changes ensure the entire height chain from `DialogContent` down to the scroll viewport uses flex layout, avoiding the CSS percentage-height-vs-flex-computed-height pitfall.
