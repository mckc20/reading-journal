# Redesign workshop

Run `npm run storybook` and open http://localhost:6006. Choose **Redesign → Home → Single Book** or **Several Books**. Run `npm run build-storybook` to generate the standalone `storybook-static/` preview; this directory is ignored by Git.

For visual comparison, start with **Redesign → PDF Reference → Home**. This board stays 390px wide even in a wide Storybook canvas and reproduces the PDF's section order and independent examples. **Components → Reading Widget PDF Reference** matches the three-cover widget separately. Ordinary Home stories keep responsive layouts and fixed navigation.

Storybook uses the existing React/Vite/Tailwind configuration. Its setup follows the [official React/Vite integration](https://storybook.js.org/docs/get-started/frameworks/react-vite). Development telemetry is disabled. No Supabase configuration or login is required for these stories.

## Reference and first review

The reference is the user-supplied **Reading Journal - Modern Redesign.pdf**, reviewed on 14 November 2026. It contains an annotated Home concept, progress dialog, reading/goal/plan cards, community posts and palette explorations. The original PDF remains local; it contains personal examples and has not been published or committed.

The first implementation follows the lighter example: white and pale gray surfaces, muted blue, gold and rose accents, Lora display text and DM Sans body text. The PDF says the palette is still exploratory, so these are review values, not an approved app-wide theme. The phone layout follows the reference. Tablet/desktop composition is a proposal because the PDF does not specify those complete layouts. Dark mode is still to be designed.

## Visual fidelity review

The full PDF was reviewed again at enlarged scale, including the rasterized annotations. The default workshop now preserves these details rather than substituting a different card treatment:

| Element | Reference treatment |
| --- | --- |
| Quick reading widget | Compact gold banner, two-line italic heading, rose button with white lettering, small white ellipsis circle, and book covers sliding beneath a stationary white selection frame |
| Your Goals | White year/title/count, large serif numerator and smaller denominator, translucent rounded lower band, pale-yellow ring track and gold progress arc |
| Planned start/finish | Same blue/white/band family, prominent day followed by month/year, overlapping cover and corner arrow |
| Currently Reading | Cover extends above/below a full-width gray backing; compact metadata and progress beside it |
| Shelves | Smaller covers, consistent title/author hierarchy and a gray shelf backing behind the covers |
| Community posts | Compact preview aligned beneath the author, cover and corner arrow, ellipsis menu, decorative quotation marks and attribution |
| Comments | Rounded white panel, short top handle, author/time above indented comment text, pale-gray composer with avatar and outlined pill input |
| Header/navigation/Add | Existing book-and-quill logo, notifications bell, book/feather/compass navigation icons, rose Add trigger and pill-shaped launch choices with icons on the right. The star/Wishlist shortcut was removed at the user's request. |

The quick widget now sizes from its container, so a narrow component story does not accidentally get desktop heading sizes. Personal photos and prose remain replaced with fictional fixtures. The reference board intentionally combines the PDF's three-book quick widget and single-book reading-card example; it is a composition comparison, not a claim that those book counts represent one live account state.

Final layout refinements: at 1024px and wider, navigation sits inside the top header and is centered on the page using equal left/right grid columns. At 768–1023px it uses a second header row; phone navigation stays at the bottom. The fixed-width PDF comparison board keeps its footer navigation. Reading-card page counts are grouped with a 16px gap; each label/value stays together if the row wraps. The goal ring is anchored beside the text, with its left offset capped at 170px, rather than tracking the far right edge of a wide card.

The PDF's white-on-blue goal/plan text and white-on-rose button text do not meet normal-text contrast requirements in every size. The reference colors are preserved for review. **Home → Enhanced Contrast** is a separate proposal with darker blue/rose backings, keeping the same white text and layout. The default palette should not be treated as accessibility-approved.

## Where the implementation lives

| Responsibility | Location |
| --- | --- |
| Theme roles and responsive layout | `src/components/redesign/redesign.css` |
| Header, navigation and accessible Add launcher | `src/components/redesign/HomeShell.tsx` |
| Reading, shelf, goal, plan and post components | `src/components/redesign/HomeCards.tsx` |
| Quick-progress widget and Home composition | `src/components/redesign/RedesignHome.tsx` |
| Progress draft, validation and injected save callback | `src/components/redesign/ProgressDialog.tsx` |
| Three-row scrolling page/time controls | `src/components/redesign/ProgressWheelPicker.tsx` |
| Post preview and sharing destination dialog | `src/components/redesign/SharePostDialog.tsx` |
| Comment list/composer and accessible dialog wrapper | `src/components/redesign/CommentsPanel.tsx`, `CommentsDialog.tsx` |
| Controlled sample data and interactive Home example | `src/stories/redesign/` |
| Storybook configuration and shared CSS import | `.storybook/` |

The workshop reuses the real Button, Dialog, BookCover, BookProgress, BookStatus and EmptyState components. The new Home components accept data and callbacks; they do not import auth, application contexts or database clients. Story files own sample data and simulate responses. The proposed book-summary layout is isolated for review; reconcile it with the existing canonical BookCard before production integration rather than maintaining two summary systems.

The CSS theme is scoped to `.rj-redesign`. The deployed Dashboard and app shell have not been replaced. The shared BookProgress now has an accessible name, also benefiting its existing consumers.

## What works in the preview

- Select a currently-reading book, open progress, change the page/time, save locally, or cancel. Local progress is reset on a page reload.
- Keyboard-accessible Add menu using Radix; each item reports the requested destination.
- Add-menu circles launch from the actual + position, nearest first, with a slight overshoot; each label unfolds leftward from its circle after a short delay. Closing retracts the labels and returns circles toward +. The trigger rotates into a close mark. Reduced-motion preferences skip these animations. **Components → Add Menu Open** leaves the expanded state ready for review.
- The reading widget's ellipsis trigger keeps its rose dots and circular background when hovered, focused or open; hover/open uses the shared subtle surface tint. **Components → Reading Widget More Actions** verifies open-state styling and Escape/focus return.
- Local like/unlike state on community posts.
- Share buttons open the PDF's post-preview dialog. Choose chat, link or email, then confirm or cancel; confirmation is simulated locally.
- Comment counts open the PDF's comments panel in both Home and PDF Reference. Enter or the arrow submits locally, updates the post count, and scrolls to the new comment. Submitted comments survive closing/reopening until reload; unsent drafts are discarded on close. Failed submissions retain the draft. Closing returns focus to the post button; opening focuses the title to avoid immediately raising a phone keyboard.
- **Redesign → Comments** includes Default, Empty, Long Thread, Dialog, Dialog Open, Drag To Dismiss, Add Comment, Submit Error and Posting Comment. The long thread scrolls above a stationary composer. The dialog slides up from the bottom at every screen size, overlaying the page without blur or darkening. Drag the top handle down to dismiss; short drags settle back. On mobile the handle also acts as a keyboard-accessible close button; Escape dismisses it too. At ≥768px an × button replaces the handle. Reduced motion skips slides. **Drag To Dismiss** checks short/long drags and focus return; inline examples keep a decorative handle.
- One-book and multiple-book layouts, empty/loading/error examples, missing cover/page count, long title and completed-goal examples.
- **Home → Up Next** adds books directly below Your Goals (phone main flow; wider-screen sidebar). Cover badges are hidden because the section title already identifies the status. These books are separate from Currently Reading and the progress widget; clicking them previews their book-details destination.
- Standalone goal/plan/post cards, progress-dialog error/pending/unknown-total states, Share-dialog error state and a visual foundations story. **Progress PDF Reference** and **Share Post PDF Reference** open the dialogs immediately for visual comparison.
- Story `play` checks for saving page/time, cancelling without changing progress, retaining selections after a simulated save failure, and confirming or failing a simulated share.
- Comment `play` checks cover posting/clearing, pending controls, retaining a failed draft, and Home close/reopen with the updated count. Focused browser checks also covered whitespace rejection, reference-board integration and no horizontal overflow at 390/834/1440px. The panel and dialog passed focused axe scans; real-device software-keyboard testing remains outstanding.

Navigation, creation, timed sessions, log editing, goals/plans, notifications, recommendations, sharing and comments use sample content or report intent. They are not connected features. The Add menu reflects the PDF's Book / Journal entry / Series choices; access to author creation must be resolved before replacing the live launcher.

## Deliberate differences and unresolved behavior

- Progress now follows the PDF's wheel controls: three visible rows, a pill outline around the selection, a half-width page wheel and side-by-side hour/minute wheels on light gray panels. Scroll, tap a visible row, use arrow keys, or type digits while focused. Minutes advance in five-minute steps, matching the PDF's 00m / 05m / 10m examples. Unknown page totals extend the available rows as needed.
- The Share dialog includes the author, truncated post text, book cover, three circular destination controls and Cancel/Share actions. The fourth unlabeled circle in the PDF is decorative because no fourth destination has been specified. No messages, emails or clipboard writes occur in the workshop.
- The reading strip scrolls beneath a fixed, centered 2px white frame; neighbors use 70% opacity. Swiping, dragging and Left/Right/Home/End keys browse books. The **Update Progress** button opens progress for the centered book. Tapping a cover slides it into the frame, then opens that book's progress dialog only when it arrives; an already-centered cover opens immediately. Reduced-motion preferences use instant positioning before opening. Interrupted navigation cancels a pending dialog. End padding lets the first and last cover reach the same frame. **Home → Sliding Reading Selection** checks browsing plus the main action; **Components → Reading Widget Click Slides** checks motion, arrival before opening, and focus return.
- The draft starts at the recorded page rather than silently adding one page. Saving without reading time sends no time value. The existing app's draft defaults are unchanged.
- The PDF example's 246 / 301 pages and 40% disagree. Sample progress uses the real shared calculation; 64 / 160 is 40%.
- The quick widget's visible pill/circle proportions follow the PDF, with transparent padding retaining a 44px-high action target. See the contrast review above before adopting the reference palette in the live app.
- Progress has one save operation. Nested journal saving, completion/status transitions, changing log dates and timed start/end sessions still require behavior decisions before app integration.
- The sample goal is a book count only; it does not claim the PDF's custom goals and plans have been implemented.
- Wider navigation, secondary destinations, journal/settings layouts and state preservation still require review against D03–D08 in the wiki.

Storybook adoption (D09) is now authorized for this first slice. Other wiki decisions are not automatically closed by this prototype. No wiki pages have been changed or published in this implementation pass.

## Review and verification

Review Home at 390×844, 834×1194 and 1440×900, then resize between them. Inspect long/missing content, keyboard focus, the Add menu and the progress error/cancel stories. The Accessibility panel is available for focused checks; an automated scan is not a complete accessibility audit. Real software-keyboard and touch testing remains outstanding.

Use `npm run build` to check TypeScript and the production app build, and `npm run build-storybook` to verify the standalone preview. The app's Node tests remain available through `npm test`. The `play` checks run when their stories open; this setup does not add an automated browser-test runner or CI job.

Next, review the visual direction and interactions here, refine the shared components, then connect a small approved flow to application data. Specify completion, pending, partial-failure and cancellation behavior before changing persistence. Social sharing, reading sessions and custom plans should each have a separate implementation scope.

Comments sheet sizing refinement: the dialog spans the full viewport width at every breakpoint and sits flush with the left, right and bottom screen edges. Only its top corners are rounded. On mobile (<768px), drag or activate the handle, press Escape, or tap outside to dismiss. On tablet/desktop (≥768px), an × close button replaces the handle. Bottom composer padding includes the device safe area. Inline component examples retain their standalone PDF card shape.

Mobile upward expansion: dragging the handle upward by more than 24px expands to the height needed by the comments, capped at the viewport height minus 94px (82px Home top bar plus 12px gap), including top safe-area allowance. Short threads do not gain empty space; longer threads retain internal scrolling and the fixed composer. Arrow Up on the focused handle is the keyboard equivalent. Downward dismissal remains available after expansion. Stories Long Thread Dialog, Content Sized Dialog and Expand On Mobile support review. Browser checks covered two/six/eighteen comments, upward/downward touch gestures, content-fit sizing, 768/834/1440px close-button behavior and a compact short thread.

Swipe regression: **Comments → Swipe Up To Expand** checks upward motion across release frames and ignores a touch-generated click after the gesture. The entrance animation stays unchanged during dragging so releasing cannot replay it and jump the sheet down. Browser-dispatched touch checks cover short, content-sized and long threads plus downward dismissal.
