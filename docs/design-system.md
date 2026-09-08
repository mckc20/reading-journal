# Reading Journal Design System

## Purpose

Reading Journal should feel calm, book-focused, and information-rich without becoming cluttered. The system keeps visual decisions close to the reusable component that owns them, so a book looks like the same book on every page.

## Layers

1. **Foundations** live in `src/index.css`: semantic colors, typography, spacing, radii, shadows, icons, and light/dark values.
2. **UI primitives** in `src/components/ui` are shadcn-based building blocks such as `Button`, `Card`, `Badge`, `Input`, `Tabs`, and `Dialog`.
3. **Reading Journal components** in `src/components/reading-journal` understand app concepts: books, reading states, page hierarchy, and empty states.
4. **Pages** compose the above layers. They should supply data and layout, not redefine the visual meaning of a book, status, or generic state.

## Foundations

Use semantic Tailwind classes such as `bg-background`, `bg-card`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border`, and `text-primary`. Do not add page-local hex colors for an existing semantic role.

- Display and section headings use Lora through `AppHeading`; normal UI text uses Google Sans Flex.
- Use the spacing rhythm already represented by Tailwind's 4px scale: 4, 8, 12, 16, 24, 32, and 48px are the preferred gaps and padding values.
- Use the shared radius scale. Standard containers are `rounded-lg`; covers and small controls are `rounded-md`; do not choose different radii for the same kind of surface.
- Use `--shadow-card` for standard cards and `--shadow-card-elevated` only when a surface needs clear elevation. Interactive movement belongs to an interactive component variant.

## Component Rules

- `Button` owns action style through `default`, `secondary`, `outline`, `ghost`, `destructive`, and `link` variants. Do not create color-named button components.
- `Card` has `default`, `elevated`, and `interactive` variants. Use `interactive` only when the full card is clickable.
- `BookCover` owns cover ratio, fallback, loading, favorite marker, and paused appearance.
- `BookStatus` is the only renderer for a `BookStatus`; pages must not assign their own status badge colors.
- `BookProgress` calculates and clamps percentage from page values. It renders nothing when no valid total page count exists.
- `BookCard` is the canonical reusable book summary. Use its existing grid or shelf variants instead of rebuilding cover/title/status combinations in a page.
- `PageHeader` and `SectionHeader` establish hierarchy. Supply content and actions through props rather than rebuilding their typography structure.
- `EmptyState` is the default for empty and recoverable error areas. Pass a relevant icon and action when useful.
- `StatCard` is the shared compact statistic surface.

## Composition

Prefer this shape in page code:

```tsx
<PageHeader title="Library" description="All the books in your collection." />
<section className="space-y-3">
  <SectionHeader title="Recently Added" action={<Button variant="ghost">View all</Button>} />
  <BookCard book={book} onBook={openBook} />
</section>
```

Pages may use `className` for positioning, widths, grids, and responsive layout. Component internals own semantic presentation, including status treatment, cover behavior, card treatment, and text hierarchy.

## Visual Review Checklist

Before merging a visual change, check the affected screen at mobile and desktop widths in light and dark themes. Verify keyboard focus, interactive card activation, empty/loading/error states, missing book covers, paused and favorite covers, each book status, and progress values with missing, zero, normal, and over-total page counts.
