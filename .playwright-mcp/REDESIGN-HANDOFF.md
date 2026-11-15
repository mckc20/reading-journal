# Reading Journal redesign handoff

Updated 15 November 2026. Read this file and the repository AGENTS.md before continuing. The original conversation can be replaced; the wiki and local artifacts hold the work.

## Continuation update — Storybook first slice

Checkpoint on 15 November 2026: the Storybook setup, redesign components, stories, assets, workshop documentation and shared progress accessibility label are saved together in Git. Browser captures and reference exports remain local and ignored; this handoff is the exception. The live Dashboard is unchanged. No PR, deployment or release note is part of this checkpoint. The wiki checkout and published page links are recorded below.

15 November clarification: the user specified that the quick-reading widget's white rectangle stays stationary and covers slide beneath it. Added `QuickBookCarousel` with a fixed centered 4px frame, 70% opacity for unselected covers, center-based selection, native scroll/snap, mouse drag, click and keyboard support. First/last book can reach the frame; the selected book drives “I read today.” `Home/Sliding Reading Selection` adds a regression story. This supersedes the earlier moving-outline/click-only strip.

15 November refinement: user requested a thinner frame and a sliding transition on cover clicks. Frame is now 2px. Protected smooth scrolling from the selected-prop layout effect and prevented focus handling from instantly recentering a clicked cover. Reduced-motion preferences still position instantly. `Components/Reading Widget Click Slides` samples intermediate scroll positions as a regression check.

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
