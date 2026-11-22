# Journal — Storybook implementation plan

Status: local Storybook prototype implemented on 21 November 2026 after the continuation request. The original plan below retains its proposed/confirmed distinctions. See `storybook.md` and `.playwright-mcp/REDESIGN-HANDOFF.md` for implemented choices, verification and remaining limits. Insights and Profile were not implemented in this slice.

## Start here in a new session

Read `AGENTS.md`, `.playwright-mcp/REDESIGN-HANDOFF.md`, `docs/storybook.md` and this plan. Check `git status --short` and recent commits before editing. Preserve the uncommitted workshop files. At planning time HEAD was `c6bf1f08`; Library, Collections, Book Details, expanded Book Form and collection search work remained uncommitted.

This is a Storybook-first redesign workshop. A later request to implement this plan means local prototypes unless the user explicitly expands scope. Do not integrate production routes, auth, account data, APIs or persistence. No deployment, hosting, PR, commit/push or release note is requested by this plan. Add no changelog entry without an explicit request. The older linked redesign wiki has not been reconciled with the workshop; current user decisions take precedence.

The developer is self-taught and wants brief, practical explanations of what changed and why. Prefer small steps and readable components. Do not delegate to other agents unless explicitly authorized by the user or applicable instructions.

## Confirmed user decisions

- Journal consists of cards showing journal entries. The writing must be visible immediately; do not make users choose a book before seeing entries.
- It is not a timeline. It should feel like a collection of writing organized around books, while also supporting entries unrelated to a book.
- Independent entries are first-class content, not an error or incomplete state.
- Journal is for writing; Insights explores reading habits and achievements; Profile represents the user's chosen reader identity.

## Proposed structure to implement and review

The following details are workshop proposals, not separately approved product contracts:

1. A simple Journal heading and a clear Write an entry action.
2. Search and compact browsing controls. Start with All entries and optional Note/Quote/Review filters; inspect existing entry types before defining fixture values.
3. Responsive entry cards: one column on phones, additional columns as space permits. Preserve a logical keyboard/reading order; avoid a masonry layout that scrambles it.
4. Each card exposes an optional title, readable excerpt, entry-type label, a quiet date and its related book/series/author where present. Related cover/name is supporting context, not the main content. Avoid date rails, month headings and timeline decoration.
5. Open a card to read the full entry in a local detail view/dialog with a clear return action and restored focus.
6. Book filtering or optional grouping helps find entries without replacing the writing-first default. If grouping is added, entries remain visible beneath book labels; independent entries remain equally easy to find. Do not start with book-cover tiles that hide the writing.

Support book, series, author and independent examples. Existing production relationships may differ from this proposed independent-entry experience; represent that gap explicitly rather than modifying the database.

## Existing context and useful files

- `src/components/redesign/HomeShell.tsx`: supports `activeDestination="Journal"` and injected navigation/creation callbacks.
- `src/components/redesign/redesign.css`: scoped `.rj-redesign` visual roles; Lora headings, DM Sans body, pale surfaces and muted blue/gold/rose accents.
- `src/components/redesign/BookDetailsPreview.tsx`: contains a one-excerpt Journal section; future connection can be simulated, not assumed.
- `src/components/redesign/CollectionSearch.tsx` and its stories: mobile swipe-up reveal, swipe-down hide, full-screen search after activation, results after two trimmed characters; desktop inline right-aligned search. Reuse if appropriate, with Journal-only results. This behavior is implemented for collections but was not explicitly selected for Journal.
- Read `src/pages/LibraryJournal.tsx`, `src/components/JournalEntryCard.tsx`, `src/components/AddJournalEntryDialog.tsx` and `src/lib/journal.ts` for current types and behavior. `JournalTimeline.tsx` is existing production context, not the chosen redesign structure.
- Journal relationship/visibility/media migrations and `src/lib/bookJournal.ts`, `seriesJournal.ts`, `authorJournal.ts` explain current data limits. Read relevant code before claiming compatibility.

Preserve shared Button/Dialog/BookCover primitives and existing Home behavior. All current workshop navigation, saves, lookups, barcode and social actions are simulations or intent callbacks. No real camera, production data or backend calls.

## Incremental implementation

1. Create fictional typed fixtures and `JournalPreview.tsx`, a scoped stylesheet and `Journal.stories.tsx` under the existing redesign directories. Start with the writing-first card layout and mixed relationships. Review phone layout before adding controls.
2. Add local search/filter behavior and full-entry opening/closing. Keep results scoped to Journal and combine controls predictably. Search can include entry text and related names; document the chosen scope.
3. Add empty, loading, error/retry, no-results, long-writing, missing-cover and independent-entry stories. Avoid a layout that depends on every entry having a title, cover or relationship.
4. Connect Write an entry to a local proposal only if requested in that implementation slice. A complete rich-text editor, attachments and sharing are separate work; an explicit intent callback is an acceptable initial boundary. Do not imply a write succeeded if no local save exists.
5. Review the default page, entry details and search on phone/tablet/desktop, then record changes and limits in the workshop docs.

## Decisions still open

Default sort order; whether optional grouping is needed initially; excerpt length and card proportions; exact entry types and controls; editor scope; treatment of rich text/media/tags; independent-entry persistence; draft/cancel/save behavior; visibility and sharing. Make small reversible presentation choices, but clarify substantial new editor or persistence scope before implementing it.

## Verification and completion criteria

- Individual writing is visible immediately, including independent entries. There is no timeline or book-selection gate.
- Play checks cover opening/closing and focus return, scoped search/filter combinations, reset/no-results and retry if implemented. If local editing is included, cover save/cancel/failure retention.
- Check 320/390/834/1440px plus relevant breakpoint boundaries, no horizontal overflow, legible excerpts, keyboard navigation and dialog scrolling.
- Run focused accessibility scans; check names, headings, focus and reduced motion. Default workshop palette has known contrast limitations; do not call it fully accessible. Dark mode and real-device keyboard testing remain outstanding.
- For implementation, run `npm run build` and `npm run build-storybook`; add focused behavior checks rather than tests that merely mirror markup. Full Node tests were not rerun for the latest preview additions. Report exactly what was run.
- Check port 6006 before starting `npm run storybook -- --host 127.0.0.1`.

## Related plans

See `redesign-insights-plan.md` for habit exploration and goals, and `redesign-profile-plan.md` for user-chosen favorites and first-login setup. These plans are independent slices, not authorization for production integration or a combined app rewrite.
