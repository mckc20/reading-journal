# Insights — Storybook implementation plan

Status: local Storybook prototype implemented 22 November 2026 following the explicit Insights request. See `storybook.md` and `.playwright-mcp/REDESIGN-HANDOFF.md` for the implemented proposals, metric boundaries, checks and limitations. The original plan below retains its confirmed/proposed distinctions.

## Start here in a new session

Read `AGENTS.md`, `.playwright-mcp/REDESIGN-HANDOFF.md`, `docs/storybook.md` and this plan. Check Git status/recent commits and preserve all existing changes. At planning time HEAD was `c6bf1f08`; the latest Library/Collections, Book Details, Book Form and search additions were uncommitted.

Work is limited to Storybook prototypes unless explicitly expanded. No production integration, account data, backend writes, database migrations, deployment, hosting, PR or release note. No changelog entry without an explicit request. This plan does not authorize commit/push. The older linked wiki is historical and has not been reconciled. Explain changes in small practical steps for a self-taught developer; do not delegate without explicit authorization.

## Confirmed user direction

- Insights emphasizes reading habits, while retaining achievements.
- It should feel like exploring yourself, not just viewing a wall of statistics.
- The user specifically asked where goals belong and which insights are interesting.
- Profile favorites are manually chosen, including during first-login setup. Never calculate or overwrite them from Insights, ratings or marked favorites. Statistical observations and personal identity are separate.

## Recommended structure from the discussion

Goals living in Insights, the following sections and their exact presentation are recommendations to prototype, not explicit final approval of every metric or interaction.

Top: Insights heading, period selector (proposed: month/year/custom), a compact summary and two or three descriptive observations. Observations should open the supporting data. Keep the first screen focused on a few useful numbers and one chart, with deeper exploration below.

| Reader's question | Proposed content | Interpretation limits |
| --- | --- | --- |
| What does my reading rhythm look like? | Recorded reading days, session lengths, pages/time across weeks and returning after gaps | Missing logs do not prove no reading; pages and time may have different coverage |
| What draws me in? | Genres, authors and series returned to; changes across periods | Explain inclusion and counting; multi-genre books can appear in multiple groups |
| What do I actually enjoy? | Highly rated books/categories compared with most-read ones | Show sample sizes; few ratings cannot establish a strong preference |
| How do I move through books? | Time to finish, pauses, unfinished books and reading one/several books at once | Require reliable dates/history; treat pauses and DNF neutrally |
| What have I accomplished? | Goal progress, finished series, milestones and monthly wrap-ups | Do not infer series completion from owned books alone or invent unsupported milestones |

Suggested observation: “You recorded reading on more days this month, with shorter sessions.” Only show it when data supports both parts. Do not use predictive, psychological or judgmental claims. Do not infer time-of-day preferences without reliable session timestamps or portray gaps as failures.

Goals: proposed home for create/check/adjust interactions is Insights, beside relevant activity. Home can retain a compact goal preview. Profile can optionally display a selected achievement/goal, rather than duplicating goal management. Custom goals and plans are not already implemented by the existing Home book-count fixture.

Achievements should have a visible section near goals, without turning the page into a competition or target checklist. Monthly wrap-ups should be a distinct route into the existing report concept, not a silent recalculation of saved snapshots.

## Existing context and useful files

- `src/components/redesign/HomeShell.tsx`: `activeDestination="Insights"`; keep navigation responsive and callbacks injected.
- `src/components/redesign/redesign.css`, `HomeCards.tsx`, `RedesignHome.tsx`: shared styling and existing sample goal/plan cards. Use Lora/DM Sans and scoped theme roles.
- Inspect `src/pages/Analytics.tsx`, `src/lib/analyticsDashboard.ts`, `src/lib/bookAnalytics.ts`, `src/pages/ReadingHistory.tsx` and shared types for actual calculation/data coverage.
- Inspect `src/lib/wrapUpReports.ts`, `src/lib/wrapUpPresentation.ts`, `src/lib/wrapUpArchive.ts`, `src/pages/WrapUps.tsx` and `src/components/wrap-ups/` before designing report previews. Server snapshots live in `api/_lib/wrapUpReports.ts`.
- Actual production statistics route is `/statistics`; `/analytics` redirects there. Do not change routes for this workshop.
- Read relevant migrations before relying on reading-log/pause/date semantics. Wishlist is excluded from ordinary reading analytics and library counts.

All workshop data must be fictional fixtures or injected local callbacks. No Supabase clients, auth contexts or production statistics requests. Reuse pure calculations where genuinely suitable; do not import production fetching just to render a chart.

## Incremental implementation

1. Map each proposed metric to available fields and calculation rules. Record which are supported, sample-only or deferred. Clarify units, period boundaries and missing-data treatment. Do not add tracking to make a proposal look feasible.
2. Build `InsightsPreview.tsx`, a scoped stylesheet, fictional fixture scenarios and `Insights.stories.tsx`. Start with overview, reading rhythm and one drill-down. Use a readable chart with a text summary and accessible values.
3. Add preferences/enjoyment and book-journey sections incrementally. Period changes must update observations and supporting values together. Clearly distinguish all-time goals from the selected reporting period if both appear.
4. Add goals/achievements and a wrap-up preview. Initially use intent callbacks for unapproved goal editing/report navigation; if a local goal form is included, explicitly document its draft/save/cancel contract. Do not imply production goal types exist.
5. Add populated, sparse, no-data, missing-time, no-ratings, paused/DNF, achieved-goal and loading/error stories. Demonstrate an interesting difference between most-read and highest-rated categories without altering Profile favorites.
6. Review whether the page feels curious and useful rather than crowded. Update workshop docs with supported metrics and unresolved contracts.

## Decisions still open

Final section order; initial period; which metrics deserve the first screen; chart formats; minimum sample sizes; comparison periods; goal types and editing behavior; milestone definitions; series completion evidence; optional Profile displays. Ask for feedback on major goal scope rather than building a general-purpose goal engine. No new tracking, recommendations engine or production analytics model is authorized.

## Verification and completion criteria

- Habits lead, achievements remain easy to find, and goals have a clear proposed location.
- Every observation has visible supporting values and handles insufficient data honestly. No division by zero, fabricated time, misleading “no reading” claim or Wishlist leakage.
- Play checks cover period changes, drill-down/back/focus return, empty states and any locally implemented goal actions. Add focused calculation tests if new nontrivial pure calculations are introduced.
- Check 320/390/834/1440px; charts fit narrow screens, values are understandable without color/hover alone, and keyboard users can reach controls and detail views.
- Focused accessibility scans do not establish a complete audit. Default palette has known contrast limitations; accessible palette selection, dark mode and real-device checks remain outstanding.
- During implementation run `npm run build` and `npm run build-storybook` and relevant focused tests. The full Node suite was not rerun for the latest preview additions; report actual checks.
- Check port 6006 before starting `npm run storybook -- --host 127.0.0.1`.

## Related plans

`redesign-journal-plan.md`: writing-first entry cards. `redesign-profile-plan.md`: manually chosen reader identity and favorites. The previously suggested Library → Details → Edit → Save local journey was a recommendation, not a prerequisite or an implemented feature.
