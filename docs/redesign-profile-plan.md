# Profile — Storybook implementation plan

Status: local Storybook prototype implemented 22 November 2026 following the explicit Profile request. See `storybook.md` and `.playwright-mcp/REDESIGN-HANDOFF.md` for implemented proposals, verification and limits. The original plan below retains its confirmed/proposed distinctions. Insights remains planning only.

## Start here in a new session

Read `AGENTS.md`, `.playwright-mcp/REDESIGN-HANDOFF.md`, `docs/storybook.md` and this plan. Check Git status and recent commits before editing. Preserve all workshop changes, including untracked files. At planning time HEAD was `c6bf1f08`; follow-up Library/Collections, Details, Form and search work remained uncommitted.

Implement only Storybook prototypes when this plan is picked up, unless the user explicitly requests more. Do not connect real first-login detection, auth, profile writes, public visibility, search services or database changes. No deployment, online hosting, PR, commit/push or release notes are requested. No changelog without explicit user request. The older linked wiki needs reconciliation and must not override these decisions.

Explain choices in clear practical language for the self-taught developer. Keep changes incremental. Do not delegate without explicit authorization.

## Confirmed user decisions — latest instruction wins

- Profile serves both the user and community visitors. Community features remain available but are less prominent.
- Include favorite genre, author and series (when applicable). The latest instruction also includes favorite book.
- On the very first login, a form opens so the user can choose their favorite genre, author, series and book.
- Users can manually change these favorites later.
- No automatic filling. Earlier discussion of deriving favorites from ratings/marked favorites and allowing overrides was explicitly superseded. Do not implement ranking, suggestions based on reading statistics, automatic replacement or background updates.
- Insights may describe recorded reading patterns, but must never populate or overwrite Profile favorites.

## Proposed page and first-login experience

These layout/interaction details are recommendations from the discussion, not all separately confirmed:

1. Identity header: avatar, name, optional bio and Edit profile action for the owner.
2. Reading favorites: clearly labeled genre, author, series and book, using the user's chosen values. Book/series covers can support the text without crowding the page.
3. Currently reading and selected favorite books, if useful, followed by a small optional achievements section. These are proposals; do not duplicate every Library shelf or Insights chart.
4. A clear Settings entry point for the owner. Profile should support account access without becoming a long account-settings form.
5. A Preview public profile action to explain what a visitor sees. Prototype owner and visitor views separately; do not invent production privacy guarantees.

First-login proposal: a short “Make this profile yours” form with four optional favorite choices. Recommend allowing Skip and allowing choices beyond the user's library because new accounts may contain no books. Blank values stay blank; no defaults inferred from sample ratings or activity. The user confirmed the first-login form, but optionality, Skip and the exact picker behavior still need review.

Later Edit profile should allow replacing and clearing each favorite. Proposed empty treatment: a small invitation to add favorites on the owner's page; omit empty favorite sections in visitor view. A series is not mandatory if the user has no applicable favorite. Do not automatically create a favorite series when they finish one.

## Existing context and useful files

- `src/components/redesign/HomeShell.tsx`: supports `activeDestination="Profile"`; shared navigation and Add behavior must keep working.
- `src/components/redesign/redesign.css`: scoped theme roles, Lora headings, DM Sans body and current pale surfaces/muted accents.
- Inspect `src/pages/Profile.tsx`, `src/pages/PublicProfile.tsx`, `src/pages/Settings.tsx`, `src/components/profile/ProfileForm.tsx`, `ProfileAvatar.tsx`, `src/lib/profileForm.ts`, `src/lib/profiles.ts` and shared types for existing owner/public distinctions.
- Relevant current migrations include `20260430_auto_create_profiles_for_auth_users.sql`, `20260620_fix_public_profile_rpcs.sql`, `20260630_profile_avatars_storage.sql` and `20260826_public_profile_bio.sql`. Inspect actual schema/policies before any later production proposal; do not assume favorite fields or onboarding flags exist.
- Production routes include `/profile`, `/profiles/:profileId` and settings routes in `src/lib/router.tsx`. Do not alter them during this slice.
- Existing Book Form stories demonstrate injected local lookup/save callbacks, pending protection, failure retention and dialog focus behavior. Reuse those patterns rather than production requests.

Use fictional names, bios and assets. No personal account data, real uploads, public writes or actual external catalog calls. Pickers can use an injected sample catalog; label the simulation clearly in story documentation without putting implementation jargon into the product UI.

## Incremental implementation

1. Define a small preview model for the four explicitly chosen favorites, independent of calculated Insights. Use optional values; choose local fixture IDs/display metadata without claiming a production storage contract. Confirm whether singular choices are sufficient before introducing multiple favorites per category.
2. Build `ProfilePreview.tsx`, scoped CSS and `Profile.stories.tsx` with owner, visitor, sparse and complete examples. Start with identity and favorites before secondary sections.
3. Add a first-login setup story that opens the form based on an explicit story flag, never the real auth session. Use local selection/search fixtures for all four categories; demonstrate a new user with an empty library. Do not limit choices to books already logged unless the user changes direction.
4. Add manual editing, replacing and clearing favorites. Keep a local draft until Save; Cancel leaves displayed values unchanged. This is a proposed contract. Pending save protects against duplicate submission; failed save retains the draft. Demonstrate save/reopen in memory and document that reload resets the simulation.
5. Show that changing fixture ratings, finishing books or marking library favorites does not silently change chosen Profile favorites. Distinguish a single chosen favorite book from any broader favorite-book shelf.
6. Add the public-preview proposal with clear return/focus behavior and owner-only controls absent from visitor mode. Visibility controls are a separate decision, not an assumed backend feature.
7. Review phone/desktop and update workshop documentation, explicitly recording what is still needed for real onboarding and persistence.

## Decisions still open

Are favorites optional and is setup skippable? One or several per category? Can users enter an item missing from a catalog, and how? Does “series if the user read one” merely make the field optional, or require reading history? Which identity fields are in first-login setup? What is visible to visitors? Which achievements/current reading belong on Profile? How should existing users encounter setup? Production first-login tracking, dismissal/retry rules, favorite persistence, privacy/RLS and live catalog integration all need separate approval and design.

Do not block a small local prototype on every open presentation detail. State assumptions, provide reviewable stories and avoid silently turning proposals into permanent account behavior.

## Verification and completion criteria

- First-login story opens setup; returning-user story shows the normal profile. No real authentication path changes.
- All four favorites can be manually selected, changed and cleared. No automatic values or statistical overwrites.
- Play checks cover local save/reopen, cancel, clearing, failed-draft retention, pending protection and public-preview focus return where implemented. Test Skip only if included as a documented proposal.
- Include no-favorites/no-series/empty-library, long-name/title, missing-cover and save-error states. Distinguish self-view controls from visitor presentation.
- Check 320/390/834/1440px, form scrolling/fixed actions, keyboard operation and picker/dialog focus. Focused accessibility scans supplement manual checks; they are not a complete audit. Final palette, dark mode and real-device keyboard behavior remain open.
- During implementation run `npm run build`, `npm run build-storybook` and focused interaction checks. Latest preview additions passed builds and focused browser checks, but did not rerun the full Node suite. Report actual validation.
- Check port 6006 before starting `npm run storybook -- --host 127.0.0.1`.

## Related plans

`redesign-insights-plan.md`: habits lead, achievements remain, goals proposed there. `redesign-journal-plan.md`: individual writing cards visible immediately, including independent entries. None of these plans authorizes production integration.
