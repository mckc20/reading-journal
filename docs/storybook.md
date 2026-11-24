# Redesign workshop

## Page plans — 21 November

Journal, Insights and Profile now have local prototypes (see below). The latest slice implemented Insights; the earlier entries retain their historical scope. For a new session, read `AGENTS.md`, `.playwright-mcp/REDESIGN-HANDOFF.md` and the relevant standalone plan:

- [Journal: writing-first entry cards](redesign-journal-plan.md), including book-related and independent entries without a timeline.
- [Insights: habits, self-exploration and achievements](redesign-insights-plan.md), with goals proposed here.
- [Profile: reader identity and manual favorites](redesign-profile-plan.md), including a first-login favorites form and later editing. Automatic favorites were explicitly rejected.

The plans distinguish confirmed requirements from layout/behavior proposals and keep implementation scoped to local Storybook simulations.

Run `npm run storybook` and open http://localhost:6006. Choose **Redesign → Home → Single Book** or **Several Books**. Run `npm run build-storybook` to generate the standalone `storybook-static/` preview; this directory is ignored by Git.

For visual comparison, start with **Redesign → PDF Reference → Home**. This board stays 390px wide even in a wide Storybook canvas and reproduces the PDF's section order and independent examples. **Components → Reading Widget PDF Reference** matches the three-cover widget separately. Ordinary Home stories keep responsive layouts and fixed navigation.

Storybook uses the existing React/Vite/Tailwind configuration. Its setup follows the [official React/Vite integration](https://storybook.js.org/docs/get-started/frameworks/react-vite). Development telemetry is disabled. No Supabase configuration or login is required for these stories.

## Insights workshop — 22 November

Open **Redesign → Insights → Overview** at [the local preview](http://127.0.0.1:6006/?path=/story/redesign-insights--overview). The latest request selected Insights; Journal and Profile were already implemented. Existing workshop components, including HomeShell, were not edited in this slice. Port 6006 already had Storybook running and was reused.

`InsightsPreview.tsx` and `insights-preview.css` reuse HomeShell, Button, Dialog and EmptyState. The five reader questions guide rhythm, finished-book genres/author/series returns, ratings, neutral book journeys, then achievements. Rhythm leads with three summary values, one chart and two observations that open supporting values. The chart uses visible labels and numbers, without hover or color as the only source of information. Details focus the title, trap keyboard focus, scroll internally, keep Back stationary and restore the originating button on Back/Escape.

Reversible presentation proposals: October 2026 as the initial period, a year-to-date alternative through 22 November, Europe/Vienna calendar boundaries, horizontal bars, and one/two-column exploration below/above 768px. No custom dates or arbitrary period calculations. `insightsFixtures.ts` supplies complete fictional summaries for each period; selection changes the chart, observations, coverage, genres, ratings and journeys together. These are display fixtures, not calculations against book records. All names and prose are fictional. No production fetching or Profile favorite logic is imported.

The yearly book goal sits beside a supplied milestone under achievements, visibly independent of the reporting period. Review goal reports intent only; there is no goal form, create/save flow or general goal engine. The supplied series milestone explicitly asserts a complete three-volume published list; it is not inferred from owned books. The saved September wrap-up opens a separate read-only excerpt and remains unchanged when the period changes. All wrap-ups reports archive intent; no report is generated, recalculated or overwritten.

### Metric map and boundaries

| Display | Prototype rule | Production feasibility / limit |
| --- | --- | --- |
| Recorded reading days and chart | Distinct calendar dates with positive page activity or reading minutes; dates with no records are not proof of no reading. Bucket day counts sum to the summary. | Logs supply timestamps, page positions and optional minutes. Page positions need the existing delta rules, not direct summation. This prototype supplies counts and does not recalculate them. |
| Average timed log | Supplied mean of logs with recorded minutes; coverage shows timed/all log counts. No timed records means unavailable, not zero. | Supported by optional log minutes; a log is not necessarily a complete session. No time-of-day or psychological inference. |
| Comparison | Month shows its supplied September day count and time average in details. Year has no unsupported prior-year comparison. | Fixture-only comparison, not a live analytics contract. |
| Finished books and genres | Finish dates within the inclusive displayed range; one count per book per genre. Multi-genre counts may overlap. | Book dates and linked metadata exist; missing dates/categories cannot be inferred. Wishlist is excluded from the supplied analytics fixtures. |
| Enjoyment | Current ratings of period-finished books; averages exclude unrated books and always show rated sample sizes. | Current rating is not a historical snapshot. One rating is weak evidence; no automatic Profile favorites. |
| Author/series returns | Explicit supplied finished-book counts for the selected period. | Linked authors/series support counting; series completion also requires a reliable full volume list. |
| Book journey | Explicit fictional start/finish and pause/DNF event dates. Elapsed start-to-finish days include both endpoints and pauses. | Dated logs/pause periods support parts of this; current DNF status alone cannot establish when a book was abandoned. No historical status or concurrent-book calculation was added. |
| Goal / milestone | Supplied full-year finished count and target; explicitly supplied milestone evidence. | Goal types, creation/editing, milestone rules and storage need later design. |
| Saved wrap-up | Independent supplied excerpt, not recomputed from the selected period. | Real reports are immutable saved snapshots; no production report component/data loader is connected. |

Review **Sparse**, **No Data**, **Missing Time**, **No Ratings**, **Paused And DNF**, **Achieved Goal**, **Loading** and **Load Error**. Sparse shows the limitations of a single rating. No Data leaves goals/achievements accessible and says missing logs do not establish no reading. Retry locally removes the supplied error. Reload resets all simulation state. Navigation, notifications, Add, goal review and archive actions report intent only.

Verification performed in desktop Chrome with Playwright:

- Six interaction stories passed at 390/1440px: Period And Evidence, Compare And Return, Missing Evidence, Snapshot And Intents, Observation Details and Retry. Period changes, supporting values, both observations, missing time, no data, return focus, stable yearly goal and unchanged saved snapshot were exercised.
- Nine display states fit 320/390/599/600/767/768/834/1023/1024/1440px without horizontal page overflow. Keyboard Enter, Tab/Shift+Tab containment, Escape/focus return, viewport bounds and stationary dialog actions/internal scrolling passed at 320/390/834/1440px. Reduced motion removes dialog animation. Overview phone/desktop screenshots were visually reviewed.
- Twenty focused axe scans (overview/no-data/sparse/missing-time/no-ratings/achieved-goal/error/rhythm-detail/ratings-detail/snapshot × 390/1440px) reported no violations. These scans do not constitute a full accessibility audit or palette approval.
- Representative Home, Library, Collections, Book Details, Book Form, Journal and Profile stories still render; this was a smoke check, not a rerun of all prior interactions. No console/page errors in the successful interaction/layout/keyboard checks.
- `npm run build` and `npm run build-storybook` passed. The app build first caught an unsupported test-query option, which was removed. A browser check initially used an ambiguous heading query; it was narrowed and the keyboard/visual checks rerun successfully. The full Node suite was not rerun; no new analytics calculation engine was introduced.

Limits: fictional summaries do not validate production analytics, timezone conversion or historical data coverage. Custom dates, freeform goals/plans, concurrent reading and inferred milestones are deferred. Screen readers, Safari/Firefox, dark mode, final palette/visual approval and real-device touch/software keyboards remain untested. Desktop emulation and automated scans do not replace real-device review. No production routes, auth, account data, APIs, persistence, hosting, deployment, commit/push, PR or release notes.

## Profile workshop — 22 November

Open **Redesign → Profile → Owner** at [the local preview](http://127.0.0.1:6006/?path=/story/redesign-profile--owner). Review **First Login**, **Visitor**, **Empty Library**, **No Series**, **Sparse Visitor**, **Long Names Missing Cover**, **Save Error** and **Pending Save** alongside it. This slice implements Profile only; Insights remains pending. Existing Home, Library, Collections, Book Details, Book Form and Journal components were not edited.

`ProfilePreview.tsx` and `profile-preview.css` reuse HomeShell, Button, Dialog and BookCover. Identity and four chosen reading favorites lead. The owner has Edit profile, Settings and Preview public profile actions; one current book and an optional supplied milestone follow below. Community is quiet rather than a feed. Visitor mode shows identity, nonempty favorites and a conversation action. The public preview shows identity and nonempty favorites, with Back/Escape returning focus to its trigger. Current reading and milestones are owner-only proposals here; no production visibility or privacy rule is implied.

All names, prose, catalog choices and inline SVG cover artwork are fictional. `profileFixtures.ts` supplies the four-category catalog independently of library activity. The single chosen favorite book is separate from library books marked as favorites. **Activity Keeps Chosen Favorites** changes local sample status/rating/library-favorite indicators and the current book without changing chosen Profile favorites. There is no computation or effect that populates favorites from activity.

Reversible proposals: one optional favorite per category, skippable setup, favorites-only setup (identity fields appear in later Edit), native selectors with keyboard type-ahead, no series history requirement, and one/two-column favorite cards below/above 600px. Native selectors use the small supplied catalog; missing catalog items cannot be created here. A saved choice remains available when absent from the current catalog, demonstrated by the long-name fixture. Blank values stay blank, including when the library is empty. These choices and exact visitor content still need product review.

**First Login** opens setup from an explicit story flag; no session or real first-login detection is read. Save accepts optional blank choices. Skip/Escape discards setup edits. Later Edit starts from the last successfully saved local values and allows replacing or clearing all four favorites, display name and bio. Display name is required; bio is optional. Cancel/Escape discards the draft. Outside taps keep the form open. Save calls an injected callback, updates the displayed profile only after success, retains failed drafts for retry and disables inputs/actions/dismissal while pending. A synchronous guard prevents duplicate requests. The form scrolls internally with stationary actions. Opening focuses the title; closing restores the actual originating edit button, falling back to Edit profile after an empty-state invitation disappears. Reload resets this entire simulation.

Settings, book details, notifications, navigation, Add and conversation actions report intent only. There is no avatar upload, free-text catalog creation, real lookup, privacy editor, follower system, goal management, production route, auth integration, account data, API or persistence. Future onboarding flags, dismissal/retry rules, catalog search, storage and privacy/RLS need separate design and authorization.

Verification performed in desktop Chrome with Playwright:

- Nine interaction stories passed at 390 and 1440px: Setup And Reopen, Skip Setup, Edit Cancel And Clear, Replace Favorites, Failed Draft And Retry, Protect Pending Save, Public Preview And Return, Visitor Actions and Activity Keeps Chosen Favorites. No console/page errors in the successful run. Checks also covered all-blank setup save, whitespace-only display-name rejection and Settings/book-detail intents.
- Owner/visitor/empty-library/no-series/sparse-visitor/long-name/first-login states fit 320/390/599/600/767/768/834/1023/1024/1440px without horizontal page overflow. Setup stayed within 12px viewport margins. After correcting the definition-list markup, owner/visitor/empty-library/first-login/edit/public/error states passed 14 focused axe scans at 390/1440px with no violations. This is not a full audit or overall palette approval.
- At 320/390/834/1440px, keyboard Enter, Tab/Shift+Tab containment, native picker type-ahead, Escape/focus return and stationary form actions were checked. The public preview also fits within viewport margins, scrolls its contents internally and keeps its header/Back action stationary. Empty-state invitation focus return and reduced-motion behavior passed. Browser checks wait for dialog animations/focus restoration before subsequent actions or measurements.
- Phone/desktop owner, setup and form screenshots, plus public-preview viewport screenshots, were visually reviewed. Representative existing Home, Library, Collections, Book Details, Book Form and Journal stories still render; this was a smoke check, not a rerun of all their interactions.
- Final `npm run build` and `npm run build-storybook` passed. The full Node suite was not rerun for this isolated preview. Storybook was initially running on port 6006; it stopped during verification, was rechecked/restarted with the requested command and was left running.

Remaining limits: desktop Chrome emulation does not establish real-device touch, native picker or software-keyboard usability. Screen-reader review, Safari/Firefox, dark mode, final palette and presentation approval remain open. Onboarding optionality/Skip, singular choices, catalog/free-text behavior and visitor visibility are proposals. Real first-login tracking, existing-user setup, account writes and privacy/RLS need separately authorized work. No production integration, hosting, deployment, commit/push, PR or release note was made.

## Journal workshop — 21 November

Open **Redesign → Journal → Populated** at [the local preview](http://127.0.0.1:6006/?path=/story/redesign-journal--populated). This checkpoint implemented Journal only; Profile was added in the later slice above. Existing Home, Library, Collections, Book Details and Book Form files were left untouched.

`JournalPreview.tsx` and `journal-preview.css` reuse HomeShell, Button, Dialog, BookCover and EmptyState. Cards expose writing immediately, with book/series/author context below it and independent entries in the same grid. There is no timeline or book-selection gate. Fictional fixtures include an untitled independent entry, invented quote, review, missing covers and long writing. Note/Quote/Review reuse the existing `JournalEntryLabel` values; generated reading events are not writing cards.

Reversible presentation choices: newest date first (stable ID tie-break), six-line excerpts, one/two/three columns at <600/600/1024px, warm neutral/gold/rose card surfaces, and visible labeled controls on every width. Journal does not adopt Library’s gesture search. Search matches only supplied journal titles, writing, attribution and related names, case-insensitively after trimming. Entry type and exact relationship filters combine with it; independent entries have their own filter. Reset clears all three controls. Search has no minimum character threshold.

Read entry opens a named modal with complete plain text, preserved paragraphs, a keyboard-focusable scrolling region and stationary Back to journal action. Opening focuses the title; Escape or Back returns focus to the originating card. The selected entry remains mounted during the closing animation so its accessible name is retained. No editor is included: Write an entry and the shared Add launcher report intent, without adding an entry or claiming a save. Retry recovers locally from a supplied error. Reload resets all simulation state.

Verification performed in desktop Chromium via Playwright:

- Five interaction stories (**Read And Return, Search And Filter, Retry, Write Intent, Read Long Writing**) passed at 390 and 1440px, with no console errors in the final run.
- Populated layouts fit 320/390/599/600/767/768/834/1023/1024/1440px without horizontal overflow. Empty/loading/error/no-results/independent/long-writing/missing-cover states also fit 320/834px. Phone and desktop screenshots were visually reviewed.
- Keyboard Enter, Tab focus containment, Escape, focus return, scrollable full writing and fixed reader actions were checked at 320/390/834/1440px. Reduced motion removes the reader animation. The long reader fits within 12px viewport margins.
- Focused axe scans of populated, empty, no-results and long-reader states at 390/1440px reported no violations. This is not a full accessibility audit and does not approve the workshop’s overall palette.
- `npm run build` and `npm run build-storybook` passed. The full Node suite was not rerun for this isolated preview slice.

Limits: plain text only, no rich-text/media/tag/visibility/sharing or editing behavior. Independent entries are a proposed preview model; current production journal records require book/series/author relationships. No persistence or schema contract was introduced. Dark mode, screen-reader usability, real-device touch/software-keyboard behavior and final visual approval remain outstanding. Automated browser checks do not replace real-device testing. No production integration, deployment, hosting, commit/push, PR or release notes.

## Next-page workshop

The 15 November follow-up adds three proposed page patterns using the Home visual direction. These extend the workshop; the PDF does not specify their full layouts, and they do not replace app routes.

| Story group | Review first | Working sample behavior | Scope limits |
| --- | --- | --- | --- |
| Redesign / Book Details | Reading, Up Next, Paused, Finished, Missing Metadata, Long Description | Cover-first layout, separate About/Reading Progress/Journal, local favorite toggle, disclosure and shared progress save/cancel flows | Start/Resume changes the sample status only after Save; Cancel preserves it. Final-page completion is undecided. Edit, analytics, reread, journal creation/opening and navigation report intent. |
| Redesign / Library | Populated, Sparse, Empty, Loading, Load Error, No Results | Title/author search, sorting, grid/list views, retry recovery and navigation to Collections | Wishlist entries are excluded. Status/source/favorite filters have been removed. Series and book opening report intent. |
| Redesign / Collections | Default Collections, Empty, Wishlist, Favorites, Empty Collection | Eight automatic collections, counts/cover previews, opening a collection, returning to the index and scoped search | Derived from sample statuses/favorite flags; no collection records or production persistence. Wishlist is included only in its own collection. |
| Redesign / Book Form | Add Book, Populated, Edit Book, ISBN Lookup, Title Lookup, Wishlist, Reading | Catalog search, local cover selection, authors/genres, series/volume, status/language/pages, secondary metadata, description and conditional reading/Wishlist fields | Lookup, barcode and saves use injected sample callbacks. Author/genre choices are local names, not production relation writes. No camera/network lookup or storage upload. |

Book Details keeps its main reading action beneath its title and cover on phone. Library and details share HomeShell, which now accepts an active destination so Library is correctly marked in navigation. Each page has a dedicated stylesheet and keeps the existing scoped palette.

Book Form uses a full-screen phone dialog and centered wider dialog. The header and actions stay outside the form's internal scroll area. Outside taps retain the draft; Cancel and Escape discard it, except during a pending save. Failure retains edits and validation focuses the first invalid field. Reopening starts from the last locally saved values. These are workshop contracts to review before persistence integration; real-device keyboard testing is still required.

The new story groups are review screens, not a connected app journey. Library connects Books, Collections and Series locally with sample data. Their `play` checks cover progress save/cancel/resume/completion boundaries, library search/reset/sort/view switching, collection membership/navigation and form validation/save/cancel/failure/pending behavior.

Follow-up verification: all 13 new interaction stories ran without browser errors after fixes. Layout checks covered 320/390/834/1440px; form checks additionally covered 767/768px, full-screen mobile bounds, internal scrolling and stationary actions. Focused axe scans of Reading details, populated Library and Edit Book reported no violations after correcting library card names. This does not replace a full accessibility audit or real-device keyboard checks. App and Storybook production builds passed; the Node suite was not rerun for these isolated preview additions.

### Collection search refinement — 17 November

Library navigation now contains Books, Collections and Series. Authors, Genres and the standalone Wishlist tab were removed from this row at the user's request. Isolated author/genre search-scoping examples remain available for component review.

Below 768px, pull down at the top of the Library to reveal a search field just below the tab divider. Keyboard focus also reveals it. The cards stay visible when the field receives focus. Typing filters the current view in place from the first character. Hide Search or Escape clears and hides the field.

At 768px and wider, search stays inline. Books matches titles and authors, Collections matches collection names or the books in an opened collection, and Series matches titles and authors. Each tab owns its own query.

The Library story uses the signed-in app’s layouts. Series and Collections use the same square cover collage with rounded cover corners. Books offers a grid and a list with cover thumbnails, titles, authors, and chevrons. Their colored tab highlight slides between selections and respects reduced motion. **Library / Mobile Search** checks pull-down, focus, typing, empty results and dismissal. **Redesign / Collection Search** checks that a query stays in its current view.

### Collections page — 17 November

The Collections tab contains To Read, Finished, DNF, Wishlist and Favorites. The Grid/List switch sits beside the Library heading. Sorting lives in Books and applies across the three tabs. Collection squares use a mosaic of up to three covers and take their tint from the first cover, using the same palette as the Book Detail hero. Status collections appear when they contain books. Favorites is always available. Clicking a card opens its books; All collections returns focus to the originating card. `LibraryBookGrid.tsx` shares book presentation with Books. The Books header has no subtitle or Add a book button.

Status collections use the matching book status. Favorites includes favorite library books; Wishlist books remain excluded from ordinary library/Favorites counts. The index searches collection names; an opened collection searches only its own books. Wishes can be found in Wishlist without leaking into Books results. The signed-in Library uses these same Books and Collections components.

**Collections / Open Collections**, **Search Inside Wishlist** and **Library / Browse Collections** check membership, wishlist exclusion, local navigation, search scoping and return focus. Updated search and presentation stories also pass at phone/desktop widths. Layout checks cover 320/390/834/1440px without overflow; focused axe scans of the index, Wishlist and Books report no violations.

### Book details inspiration refinement — 17 November

The user supplied a cover-first book-detail screenshot as structural inspiration. The workshop retains its own white/pale-gold surfaces, Lora/DM Sans typography and rounded controls. Phone now has a centered larger cover on a pale-gold backdrop, Back/More actions, then title/author, favorite heart, status/rating, one compact page/percentage row and reading/Add entry actions. Wider layouts place the cover beside that summary. The cover is intentionally shorter than the reference to keep the daily action near the initial phone viewport.

About, Reading Progress and Journal follow as separate sections. Genres/format/language move into About, descriptions expand only when long, and source/publication details sit in a native disclosure. Missing metadata rows are omitted. Reading Progress shows at most one date and reading time, with View more reporting the analytics destination; no speed metric or chart crowds this overview. Journal shows one excerpt and an Open journal destination. Dates/time come from explicit fictional story values, not guessed calculations; the supplied screenshot's personal journal prose is not copied.

Favorite toggling, Show more/less and the Edit menu work locally alongside existing progress stories. **Explore Details** checks disclosure, expansion, favorite state and the menu. All seven detail interaction checks passed at 390/1440px; Reading/Finished/missing-data layouts fit 320/390/834/1440px without horizontal overflow. Focused axe scans passed after checking definition-list structure and action names. Production data integration and real-device keyboard testing remain outside the workshop.

### Expanded Book Form — 17 November

The form now covers the options in the user's Add Book screenshot. ISBN/Book title search and a Scan ISBN barcode action sit above cover/title/author/genre entry. Authors and genres support sample suggestions, additions/removals and multiple values. Status, language, total pages and series are in the main form; choosing a series reveals volume. Description stays outside the collapsible Secondary Information section, which holds publication year, format, source and ISBN. Reading status reveals current page; relevant statuses reveal start/finish dates. Wishlist adds price and purchase link. The close control, Cancel and submit actions remain visible around the internal scroll area.

`BookLookupPreview.tsx` accepts injected catalog and barcode callbacks. Storybook searches a small public-book fixture catalog and returns a sample barcode without opening the camera. Selecting a result replaces bibliographic metadata/cover while preserving status, source and series; this is explicit before selection. Search failure/no-results leave manual entry available; request identifiers ignore stale results after edits, mode changes or unmounting. No API keys, Supabase clients or production book lookups are used.

Local JPG/PNG/WebP selection previews a cover (up to 10 MB). The fixture wrapper retains its data URL only in memory for save/reopen review; it is not an upload or production storage contract. Authors/genres likewise remain local names, and series choices are sample IDs. Year parsing reuses the app helper. Validation checks required fields, pages/volume/year, date order and Wishlist price/link. Using lookup or loading a cover temporarily disables submission; a pending save disables all edits/dismissal. Cancelling drops unsaved metadata.

Twelve form interaction stories pass at 390/1440px, covering validation/save/cancel/failure/pending plus ISBN/barcode/title lookup, lookup failure/no-results, cover/genre/series retention, Wishlist details and date order. Layout checks at 320/390/768/834/1440px show no horizontal overflow with stationary actions. Focused Add/Edit/Wishlist/lookup scans report no axe violations. Real-device camera/keyboard and live catalog/storage/persistence integration are still separate work.

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
