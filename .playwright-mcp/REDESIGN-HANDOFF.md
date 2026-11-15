# Reading Journal redesign handoff

Updated 15 November 2026. Read this file and the repository AGENTS.md before continuing. The original conversation can be replaced; the wiki and local artifacts hold the work.

## Current state — start here in a new session

The current task is a **Storybook-first redesign workshop**, based on the supplied PDF. The original baseline and wiki analysis are complete. Storybook is installed and the Home/component prototypes are implemented. The live Dashboard has not been replaced. App/backend integration, another page, a PR, deployment and a release note have not been requested.

The original workshop checkpoint is `541cffb8` (`chore: checkpoint Storybook redesign workshop`). Follow-up interactions/layouts, ellipsis-menu fix and the first Up Next state were committed as `51c5366f`. The user authorized committing all remaining changes and pushing all outgoing commits on 15 November. The latest checkpoint includes badge removal, Add-menu motion, the comments panel, responsive close controls, content-limited expansion and the swipe animation fix. Use `git log -1 --oneline` and `git status --short` to establish the current checkout before continuing.

### Open the workshop

- Run `npm run storybook -- --host 127.0.0.1`; the server is normally at http://127.0.0.1:6006. Check whether it is already running before starting another process. A running process is not guaranteed to survive a session change.
- Main responsive Home: http://127.0.0.1:6006/?path=/story/redesign-home--single-book. Use **Several Books**, **Empty**, **Loading**, and **Load Error** for other states.
- PDF composition board: http://127.0.0.1:6006/?path=/story/redesign-pdf-reference--home. This is intentionally a fixed-width phone comparison with footer navigation and independent sample states; use the Home stories to review desktop/tablet behavior.
- Standalone widget: `Redesign/Components/Reading Widget PDF Reference`. Regression stories: **Reading Widget Click Slides**, **Reading Widget More Actions**, **Home/Sliding Reading Selection**, **Save Progress**, **Cancel Progress**, and the progress/share error stories. Their `play` functions run when those stories open; there is no separate browser-test CI runner.
- Detailed implementation map and limitations: `docs/storybook.md`. Presentational components are in `src/components/redesign/`, controlled data/interaction examples in `src/stories/redesign/`, config in `.storybook/`.

### Latest user-approved behavior and layout

- The gold reading widget's main action is **Update Progress**, renamed from **I read today**.
- Its white frame is stationary, centered and 2px thick. Other covers have 70% opacity. Swiping, mouse dragging or arrow/Home/End keys browse books beneath it without opening a dialog.
- Tapping a cover outside the frame slides it into place first, then opens that book's progress dialog. Opening waits for actual centering, not a guessed delay. An already-centered cover opens immediately. Reduced motion positions instantly before opening. New navigation, focus leaving the carousel, or an interrupted gesture cancels pending activation. Closing the dialog returns focus to its trigger.
- Desktop navigation is inside the header and centered on the page at ≥1024px. At 768–1023px it occupies a second header row; phone navigation stays at the bottom. The PDF comparison board explicitly uses footer placement.
- Latest user refinement: remove the star icon and its Wishlist shortcut from the redesign header. Only the notifications bell remains on the right; the unused wishlist callback has been removed from the prototype and stories. This does not remove the live app's Wishlist feature or book status.
- Latest added state: **Redesign/Home/Up Next** supplies a separate `upNext` list and a shelf directly below Your Goals, in the phone flow or wider-screen sidebar. User subsequently requested no badges on these covers; `BookShelf.showStatus=false` hides them in this section while preserving the books' Up Next data. Other Home states do not show an empty Up Next section. These books do not enter Currently Reading or the progress carousel; book clicks preview the details destination.
- Latest Add-menu motion: circles emerge from the actual + position in staggered nearest-first order, with a small overshoot. Labels unfold leftward from the circles after a short delay. Closing reverses the sequence; + rotates into a close mark. Radix placement is measured when its root animation starts, before revealing the child animations, so collision-flipped menus use the correct origin too. Reduced-motion preferences show/hide immediately. Keyboard/Escape/focus behavior remains Radix-owned; **Components/Add Menu Open** provides an expanded review state.
- Current/Total page labels sit together with a 16px gap; each label/value remains together if the row needs to wrap. The goal ring stays near the text (left offset capped at 170px), rather than moving to the far edge of a wide card.
- Progress uses three-row wheel controls with outlined selected pills; page wheel occupies half a gray panel, hours/minutes sit side by side. Minutes step by five. Unknown/large page totals use a bounded row window. One save operation, no nested journal editor.
- Share dialog includes author, excerpt, cover, circular chat/link/email choices and Cancel/Share. The PDF's unspecified fourth circle is decorative.
- Comments are now implemented from the PDF: rounded white panel, draggable top handle, author/time and indented text, gray composer with avatar and outlined pill input. **Redesign/Comments** has populated/empty/long-thread/dialog/error/pending examples. Home and PDF Reference post comment counts open the dialog; Enter or the arrow adds a local comment and updates the count. Submitted comments survive closing until reload; unsent drafts are discarded on close, failed drafts retained. Long lists scroll independently. The dialog focuses its title on opening, returns focus on closing, and blocks dismissal while submission is pending. Latest user refinement: the dialog slides up from the bottom on every viewport over a fully transparent, unblurred overlay. Drag the top handle downward to dismiss; short drags settle back. Handle activation and Escape also dismiss. Reduced motion skips slides. Exit animation finishes before notifying the caller, including callers that unmount on close. Shared DialogContent accepts an optional overlayClassName so this treatment applies only to comments. Inline panel stories keep a decorative handle. No reaction picker is implemented.
- Latest bug fixed: the ellipsis trigger's white circle and rose dots disappeared/turned black when its menu opened because the CSS used `:last-child`; Radix inserts menu content after the trigger. Its own `rj-more-reading-trigger` class now keeps styling stable through open/hover/focus, with the usual subtle surface tint. **Reading Widget More Actions** checks appearance, dimensions and Escape/focus return.

- Latest responsive comments refinement: Mobile upward expansion: dragging the handle upward by more than 24px expands to the height needed by the comments, capped at the viewport height minus 94px (82px Home top bar plus 12px gap), including top safe-area allowance. Short threads do not gain empty space; longer threads retain internal scrolling and the fixed composer. Arrow Up on the focused handle is the keyboard equivalent. Downward dismissal remains available after expansion. Stories Long Thread Dialog, Content Sized Dialog and Expand On Mobile support review. Browser checks covered two/six/eighteen comments, upward/downward touch gestures, content-fit sizing, 768/834/1440px close-button behavior and a compact short thread.

- Comments swipe bug fixed: the drag CSS had disabled the entrance animation, then replayed it on release when the attribute was removed. The panel jumped downward before expanding. Dragging now disables only transitions; pointer-down cancels an unfinished entrance without toggling its CSS declaration. Touch-generated clicks after a drag are suppressed regardless of click detail; fresh pointer/keyboard activation can still close the handle. **Comments/Swipe Up To Expand** checks positions across release frames and a zero-detail follow-up click. Browser touch checks covered 2/6/18-comment threads expanding without a downward jump, content-fit sizing, and downward dismissal. App and Storybook builds passed.

### Scope, remaining decisions and verification

- All sample progress, likes, comments and sharing are local simulations; reload resets them. No production account data, chats, clipboard content or email is changed. Navigation/creation, date changes, timed sessions, log editing, goals/plans, notifications and recommendations are sample content or intent-only placeholders. Comments and sharing have interactive panels with injected callbacks, without backend integration.
- Latest comments verification: app and Storybook builds passed; comment story checks passed for submission, pending controls, failed-draft retention and Home close/reopen/count. Browser checked whitespace rejection, PDF Reference integration, focus return, 390/834/1440px sizing/no horizontal overflow, internal long-thread scrolling and stationary composer. Focused panel/dialog axe scans reported no violations; real-device touch/software keyboard checks remain outstanding. Follow-up slide/drag checks passed at 390/834/1440px: clear overlay computed styles, bottom anchoring, short-drag recovery, long-drag dismissal, focus return and reduced motion. Browser-dispatched touch gestures also dismissed the Home panel. **Comments/Drag To Dismiss** adds a regression play check. The full Node suite was not rerun for this isolated workshop addition.
- Lighter PDF palette, Lora headings, DM Sans body, and rounded cards/buttons are the current reference direction. The white-on-blue/rose reference colors have known contrast failures. **Home/Enhanced Contrast** separately proposes darker backings and passed a focused axe scan; that palette has not been selected for the live app. Dark mode and real-device touch/software-keyboard checks remain outstanding.
- Preserve the existing shared Button/Dialog/BookCover/BookProgress/etc. Reconcile the prototype's book summaries with canonical BookCard before app integration. Do not infer database, auth, analytics or persistence changes from this visual workshop.
- Latest verification on 15 November: `npm run build` and `npm run build-storybook` passed; `npm test` passed all 381 tests. The test runner required execution outside the sandbox because its local IPC socket was blocked, not because a test failed. Browser checked carousel slide-before-open, local save/cancel, reduced motion, header/nav boundaries (767/768/1023/1024), 320/390/834/1024/1440 layout widths, menu keyboard actions and the fixed ellipsis open/closed colors/background/dimensions/focus. Star/Wishlist shortcut absence and the remaining notifications bell were checked at phone/tablet/desktop widths. Up Next was checked at 390/834/1440 for three badged books, direct placement after Goals, separation from the reading carousel, book-details preview action, and no horizontal overflow. These are focused checks, not a complete usability or accessibility audit.
- The user authorized a repository commit and push of all outgoing changes on 15 November. No wiki update/push, PR, explicit deployment action or release note was requested. No new changelog entry should be added unless the user asks.
- No next page or implementation phase has been selected. Ask what the user wants to refine next; do not assume production integration is approved. The historical wiki decisions below still need reconciliation with these prototype choices before broader implementation.

### Reference and privacy

The PDF is local at `/Users/martina/Downloads/Reading Journal - Modern Redesign.pdf`. It includes rasterized notes, so inspect rendered regions as well as extracted text. Five cover images are committed as fixtures; personal photos/prose were replaced with fictional data. Browser captures, manifests and PDF renders under `.playwright-mcp/` remain ignored and may contain private reference material. This handoff is the only tracked exception. Do not publish raw captures or the PDF. Existing public wiki references and capture/privacy limitations are retained below.

## Prior implementation notes (chronological)

Checkpoint on 15 November 2026: the Storybook setup, redesign components, stories, assets, workshop documentation and shared progress accessibility label are saved together in Git. Browser captures and reference exports remain local and ignored; this handoff is the exception. The live Dashboard is unchanged. No PR, deployment or release note is part of this checkpoint. The wiki checkout and published page links are recorded below.

15 November clarification: the user specified that the quick-reading widget's white rectangle stays stationary and covers slide beneath it. Added `QuickBookCarousel` with a fixed centered 4px frame, 70% opacity for unselected covers, center-based selection, native scroll/snap, mouse drag, click and keyboard support. First/last book can reach the frame; the selected book drives “I read today.” `Home/Sliding Reading Selection` adds a regression story. This supersedes the earlier moving-outline/click-only strip.

15 November refinement: user requested a thinner frame and a sliding transition on cover clicks. Frame is now 2px. Protected smooth scrolling from the selected-prop layout effect and prevented focus handling from instantly recentering a clicked cover. Reduced-motion preferences still position instantly. `Components/Reading Widget Click Slides` samples intermediate scroll positions as a regression check.

15 November interaction decision: user approved renaming “I read today” to “Update Progress” and tapping any cover to open its progress dialog, with a required slide into the fixed frame first for off-center covers. `QuickBookCarousel` now waits for actual centering before activation (not a fixed delay), opens centered covers immediately, and cancels pending activation when browsing is interrupted. Swipe/drag/arrow navigation still browse only. Standalone widget stories now open a real sample-data ProgressDialog too. The reference board and Home use the same behavior; saves remain local simulations.

15 November final layout refinements: user requested desktop navigation in the top bar centered beside the branding, grouped Current/Total page counts, and the goal ring closer to its text on wider portrait/tablet layouts. HomeShell now places its single navigation inside the header (centered grid at ≥1024px, second header row at 768–1023px, fixed bottom on phone). The PDF reference board explicitly keeps footer placement. Page-count groups use a 16px gap instead of space-between. Goal ring left offset is capped at 170px to prevent a growing gap on wide cards. Browser checked 390/834/1024/1440 widths, header centering/no overlap, grouped counts and no horizontal overflow.

This update supersedes the historical statements below that the target design has not been supplied and Storybook is not installed.

- Reviewed all six linked wiki pages against fetched `origin/master`, still at `8773a39`.
- User supplied `/Users/martina/Downloads/Reading Journal - Modern Redesign.pdf`. It is a one-page annotated concept board with Home, reading-progress dialog, cards, community interactions and palette explorations. Read both rendered images and annotations; much of the explanatory text is rasterized and absent from `pdftotext` output.
- User then asked to implement the main components and Home in Storybook first. Installed Storybook 10.6.7 for React/Vite with docs/accessibility addons and DM Sans. This authorizes the component workshop; other open wiki decisions are not automatically approved.
- Added reusable presentational components under `src/components/redesign/` and controlled examples under `src/stories/redesign/`. `.storybook/` reuses app CSS/Vite configuration. `docs/storybook.md` explains setup, mapping, behavior, deliberate differences and remaining decisions.
- Implemented the lighter PDF direction as scoped review tokens, not a global theme replacement. Phone follows the concept; wider composition is proposed. No dark redesign was supplied. Existing Dashboard and app navigation remain in place.
- Workshop includes Home, quick progress, reading/shelf cards, goals/plans, community posts, Add menu and a progress dialog. Real Button/Dialog/BookCover/BookProgress/BookStatus/EmptyState are reused. BookProgress also gained an accessible name.
- All story data and saves are local simulations. The PDF's timed sessions, log editing, custom plans, community sharing/comments and navigation destinations are not connected features. See the implementation notes before assuming complete parity.
- Follow-up review: the user identified the missing Share pop-up and the incorrect numeric page/time inputs. Added `SharePostDialog`, connected Home's Share actions, and replaced the number fields with `ProgressWheelPicker`: three rows, outlined selected pills, half-width page wheel, side-by-side hour/minute wheels and five-minute steps. Share includes author/content/cover, circular chat/link/email choices and Cancel/Share actions; the PDF's undefined fourth circle remains decorative. Sharing is simulated only. Both dialogs have dedicated PDF-reference stories.
- Follow-up verification: browser checks covered digit/arrow entry, mouse-wheel and native scrolling, page/time saving, cancellation/focus return, simulated sharing and error recovery. Both dialogs fit at 390/834/1440 without horizontal overflow and passed focused axe scans. Unknown/large page counts use a bounded row window, avoiding a huge DOM. Real-device touch testing is still outstanding.
- Full visual-fidelity follow-up: user identified goals, quick reading and other components as visually inaccurate. Re-read the PDF, enlarged its Home/plan examples, and corrected the goal/plan white typography, translucent lower bands, count/date scale and pale-gold ring track; compact gold widget with rose/white pill; reading-card backing/cover proportions; shelf rail/cover sizes; compact post previews/quote marks/menus; actual logo, navigation icons and rose pill-style Add launcher. Added the missing Change date menu item as a preview intent only.
- Found a standalone-preview sizing defect: viewport desktop rules were affecting narrow widgets in a wide Storybook browser. QuickProgress now uses a container query. Added `Redesign/PDF Reference/Home`, a fixed 390px composition board with independent example states, plus `Reading Widget PDF Reference`. Reference board footer controls are in document flow for full-page comparison; normal Home stories retain fixed/responsive behavior.
- Reference blue/rose colors with white text produce contrast violations. Preserved the reference rather than silently changing its colors, documented the issue, and added a separately labeled `Home/Enhanced Contrast` story using darker backings. Its focused axe scan reports no violations; default Home's remaining scan findings are color contrast. Do not call the default palette accessibility-approved.
- Latest visual checks: no horizontal overflow at 320/390/834/1440; narrow widget stays 18px/136px heading at wide browser size. Build and Storybook build pass. Existing local progress/share flows, simulated failure stories, and Add/post menu keyboard actions were checked. See `docs/storybook.md` for the review table and remaining unconnected features.
- Five book covers were extracted from the PDF into story assets. No personal avatar, prose, original PDF or private capture was added to tracked source. Do not publish the original PDF or local rendered reference images without privacy review.
- `npm test`: 381 passed. `npm run build` and `npm run build-storybook`: passed. Browser checked book selection, local saving, cancellation, focus return and keyboard Add-menu selection; no horizontal page overflow at 390/834/1440. Focused axe scans of Home at those widths and the settled progress dialog reported no violations. This is not a complete accessibility or real-device audit.
- `npm run storybook -- --host 127.0.0.1` was left running at http://127.0.0.1:6006. Open `/?path=/story/redesign-home--single-book`. Restart if the process has ended.
- The first-slice changes are included in the checkpoint described above. No app PR, release note, deployment, wiki edit or wiki push was made in this implementation pass. The baseline commit below describes the earlier capture stage.

The remaining sections describe the original baseline/handoff and retain their historical evidence limits.

## Objective and current stage

Prepare an app redesign by documenting the current interface, analysing its patterns, and mapping components to a future design. Baseline capture and first analysis are complete. The user has not supplied the intended new design or approved the open design decisions. Do not assume a new palette, navigation model, architecture, or persistence behavior has been selected.

## Published documentation

Repository: https://github.com/mckc20/reading-journal

- Baseline index: https://github.com/mckc20/reading-journal/wiki/UI-Baseline
- Findings: https://github.com/mckc20/reading-journal/wiki/Redesign-Analysis
- Illustrated component map: https://github.com/mckc20/reading-journal/wiki/Redesign-Component-Map
- Open decisions: https://github.com/mckc20/reading-journal/wiki/Redesign-Decisions
- Active reading supplement: https://github.com/mckc20/reading-journal/wiki/UI-Baseline-Reading-Progress
- Add menu supplement: https://github.com/mckc20/reading-journal/wiki/UI-Baseline-Add-Menu

The wiki is a separate Git repository. Working checkout: /private/tmp/reading-journal-wiki-baseline. Remote: git@github.com:mckc20/reading-journal.wiki.git. Branch: master. Latest published wiki commit at handoff: 8773a39, "Document global Add menu with responsive theme examples". Pull before editing; preserve subsequent user changes. Do not run the earlier generation scripts against updated wiki pages without review, because they can overwrite later edits.

## Completed work and evidence limits

- Original baseline: 59 page/tab/form states, 347 unique screenshots, grouped into eight feature pages.
- Component-map illustration pass: 24 additional element screenshots; entries distinguish actual components from context examples.
- User subsequently set The Final Empire to Reading. Captured five more states: Home with Currently Reading, Reading book details, default progress dialog, optional finished-time field, expanded blank journal editor. Added 45 images.
- User identified the global Add menu as missing. Added the open-menu state with trigger: phone drop-up and tablet/desktop dropdown, in light and dark styles. Added 12 images. It is a custom composed control in AppLayout, separate from the three creation dialogs.
- Current index: 65 UI states (59 original + 5 active-reading + 1 Add-menu state). Theme variants are not counted separately. Original captures were preserved.
- Viewports: phone 390x844, tablet 834x1194, desktop 1440x900 CSS pixels. Resized desktop Chrome is not touch/mobile-device emulation.
- Viewport and full-page images are both available; long journals use overlapping segments and dialogs have explicit outer-scroll captures. Full-page screenshots do not reveal collapsed sections or every internal scroll state.
- Most captures are light theme. Only the Add-menu supplement includes dark examples. Saved theme preference was unchanged; temporary document theme styling was restored.
- Wiki pages and representative images were verified in Chrome after publishing; image references and viewport dimensions were checked locally.

## Data and privacy constraints

The wiki is public. The user explicitly chose: "Publish redacted versions that hide sensitive content." Keep journal prose, messages, email addresses, API-key details and other identifying content masked in public captures. Existing captures retain the signed-in user's global-header avatar, as recorded in their provenance. Never publish raw local browser snapshots or manifests without reviewing them for private content.

The live app is https://my-reading-journal.vercel.app. Playwright MCP is registered using npx -y @playwright/mcp@latest --browser chrome. The user signed in themselves in its browser; check tool availability and session before assuming access. Never request their password.

At last check The Final Empire was Reading, 0 / 647 pages; ID 22f20dcd-c4ee-45f7-b3b1-1b0eadf12a5b. The user's status change was intentional. We did not save reading progress, enter or save journal text, send chats, create/revoke keys, or change book status. The progress dialog suggests page 1 as an unsaved draft; that does not mean recorded progress changed.

Opening Messages automatically marks a selected chat as read. During captures, intercept **/rest/v1/rpc/mark_group_read with a local successful response and remove the interception when leaving; document this limitation. Do not blindly navigate into chats and change unread state.

## Implementation and analysis conclusions

App source checkout at capture and handoff: 74f1c841eb7aacf764142fa40c0512429b13a47e. Deployed commit was not verified. No app implementation changes or app commits were made. Local capture files are untracked under .playwright-mcp/. No changelog entry or app PR was requested.

The app already has a documented design system in docs/design-system.md: semantic CSS tokens in src/index.css; local shadcn/Radix controls; app components under components/reading-journal/; shared typography, charts and metrics under components/design/. Preserve existing sharing. LibraryBookCard re-exports BookCard; CurrentlyReadingBookCard reuses BookCardContent. Do not infer duplication from filenames.

Eleven findings are published:

1. F01: phone book hero places primary reading action below initial viewport; Home card exposes a shortcut.
2. F02: navigation changes at 768px; filters move from dialog to inline at 1024px. Define combined tablet behavior deliberately.
3. F03: reuse a long-form pattern with clear scroll owner, action placement and errors.
4. F04: coordinate fixed form bars, bottom navigation, safe area and mobile keyboard.
5. F05: distinguish overview, exploration, detail, journal, report and settings templates/density.
6. F06: specify immediate changes versus drafts, save/cancel and failure behavior.
7. F07: consider navigation within very long journals; do not infer performance defects from screenshot length.
8. F08: phone settings sections scroll horizontally; some controls are intentionally inactive.
9. F09: preserve month/chat/draft/view state through responsive transitions.
10. F10: component semantics, nested controls, focus and dialog descriptions need accessibility review.
11. F11: expanded progress Add Entry has separate entry/progress Save/Cancel pairs; phone entry action bar crosses the editor area. JournalEntryForm has its own persistence path; clarify labels and cancellation after an entry is saved. We did not test saves/rollback against live data.

There are nine OPEN decisions (D01-D09); no proposed design has been approved. Storybook was discussed and recommended as a possible workshop for real components and controlled sample states. It is NOT installed or configured. No installation, redesign implementation, or architecture rewrite has been authorized by that discussion alone.

## Remaining work and next conversation

Start by reviewing the user's intended new design/reference and the open decisions, especially primary tasks and visual direction (D01/D02). A proposed first implementation slice is Home -> book details -> progress, but that priority still needs agreement against the intended design.

Still incomplete: save/completion/validation/error/success states; cancellation after saving a nested entry; full dark-theme review; breakpoint-boundary checks; keyboard/touch and mobile-keyboard testing; expanded navigation, notifications and other action menus; populated search, bulk selection, other view modes; destructive confirmations, duplicates, attachments/scanner permissions, valid recovery flow; mobile conversation view and internal chat scrolling. This is a first baseline and analysis, not exhaustive usability research or an accessibility audit.

## Local artifacts

- .playwright-mcp/baseline-pilot/: original HTML catalogue and pilot images.
- .playwright-mcp/baseline-catalogue/: manifest and main screenshot collection. Manifest may contain private headings; keep local.
- .playwright-mcp/component-map/: element screenshots.
- .playwright-mcp/reading-progress-supplement/: manifest and active-reading images.
- .playwright-mcp/add-menu-supplement/: manifest and light/dark menu images.
- The wiki checkout contains the published Markdown and selected image assets. Temporary files and scripts under /private/tmp may disappear; clone the wiki again if necessary.

Continue with clear explanations suitable for the user's junior development experience. Make routine small choices autonomously; discuss major architectural tradeoffs first. Do not add a release note unless explicitly requested, per AGENTS.md.

Comments sheet sizing refinement: the dialog spans the full viewport width at every breakpoint and sits flush with the left, right and bottom screen edges. Only its top corners are rounded. On mobile (<768px), drag or activate the handle, press Escape, or tap outside to dismiss. On tablet/desktop (≥768px), an × close button replaces the handle. Bottom composer padding includes the device safe area. Inline component examples retain their standalone PDF card shape.
