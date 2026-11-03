# M1 engineering report

## Delivered scope

Implemented all five screens: contest overview, bowl sheet, interactive twelve-team CFP bracket, weighted leaderboard, and labeled local organizer testing mode. Includes separate bowl/CFP draft saving and submitted snapshots, complete-entry validation, independent exact-boundary deadlines, explicit no-reseed bracket sources, downstream pick cleanup, championship tiebreaker, result entry/corrections, configurable pre-contest scoring/deadlines, sample bowl editing/creation, participant creation/review, testing clock, and repeatable seed resets.

The default data has eight ordinary bowls, eleven playoff games, twelve fictional teams, five local participants, incomplete and complete submissions, and six finalized games. An initial weighted tie and a one-click championship tiebreaker demonstration are included. Default maximum score is 30 (8 bowls + 22 CFP).

## Architecture and reliability

Presentation is separate from typed entities, bracket progression, service validation, deterministic scoring, and repository persistence. The repository exposes load/save/reset and uses a versioned localStorage key and schema version. Incompatible or malformed JSON is not silently discarded; the UI offers explicit reset. Save failures are surfaced and state is updated only after persistence succeeds.

Predictions and actual results use independent source maps. Actual winners resolve by bracket slot; correct winners score independently of predicted opponents. Each game is visited once in scoring. Scores are not separately editable. Earlier predicted winner changes clear invalid dependent paths while preserving still-valid picks. Result corrections that change advancing teams reopen affected dependent results to avoid assigning an old score to a different matchup.

Submitted picks are deep snapshots. Draft mutations cannot overwrite them. Section mutation services enforce deadlines with an injectable Clock and `now >= deadline`; UI disables selection and submission and shows the counting snapshot after lock. Scoring weights require nonnegative integers and lock on explicit contest start, any final result, or the earliest kickoff. Configuration dates must include timezone offsets; display uses the contest’s IANA timezone.

Shared competition ranks sort by weighted total, then championship prediction absolute error only after that game is final. Equal errors share rank; a missing prediction follows valid predictions. Alphabetical display order within a shared rank has no ranking effect.

## Automated verification

- `npm run build`: passed TypeScript strict compilation and Vite production bundling.
- `npm test`: 36 passed, 0 failed (31 logic cases, 5 component cases).
- Logic coverage: bowl and each CFP round weight, perfect 22-point playoff, wrong/missing picks, opponent-independent scoring, duplicate prevention, explicit feeder progression, invalid downstream cleanup and valid preservation, impossible submissions, independent actual results, corrections reopening descendants, both exact deadline boundaries, independent deadlines, submitted/draft isolation, configuration lock, invalid tiebreakers, weighted sorting, pre-final shared ties, final tiebreaker/shared ranks/missing predictions, corrected championship totals, configurable weights, storage reload, independent participants, invalid scores, invalid teams/entry IDs, schema reset.
- React Testing Library: overview/participant selector, save feedback plus reload, playoff rounds/tiebreaker, incomplete participant submission error, separate leaderboard point columns.
- Chromium browser smoke check: desktop 1440×1000 and mobile 390×844; bowl submission, CFP submission, reload, finalize demo, correct winning participant in tiebreaker, mobile bracket scrolling without page overflow; no browser page errors.
- Screenshots reviewed for desktop overview and mobile bracket. No cloud deployment was performed.

The brief’s 34 requested testing behaviors are represented across parameterized and combined cases rather than one test per numbered requirement.

## Manual acceptance steps

1. Run the PowerShell quick start. Confirm overview, five selectors, deadlines and rules.
2. Select Sam Parker. Save an incomplete bowl draft, refresh, and confirm it loads. Attempt completed submission while picks are missing; expect an error. Complete picks and submit.
3. Fill all eleven CFP slots and championship total. Submit, refresh, verify champion and total.
4. Select an advancing underdog through the championship, then change its first-round winner. Confirm invalid downstream picks clear, while unrelated branches remain. Resubmit only after repairing every missing selection.
5. Submit bowls, alter a bowl choice, and save only as draft. Move clock to exact bowl deadline. Confirm the previously submitted choice is displayed and scored, and further changes are rejected. CFP stays editable until its own deadline.
6. Reset demonstration data. View initial shared ranks. Finalize demo; Jordan and Alex have equal weighted points but Jordan wins on error 3 vs 7. Change championship score to 30–22; Alex wins the tie.
7. Correct an earlier actual winner. Confirm affected downstream results reopen and all participant predictions remain unchanged. Re-enter dependent results and check recalculation.
8. Reset to setup. Enter negative or fractional weights, invalid timezone, or deadlines at/after earliest games; expect rejection. Save valid values and reload. Begin contest and confirm fields lock.
9. Test 390px and desktop layouts. Scroll bracket horizontally on mobile; navigation and leaderboard have their own horizontal scroll regions.

## Assumptions and scope choices

- Default demonstration clock precedes seeded finalized results so both editable picks and scoring are visible. This intentionally fictional time combination is labeled in the README. Reset to setup gives a clean pre-contest flow.
- Bowl and CFP teams share the twelve fictional seed teams; ordinary bowls have independent games and picks.
- Completed/remaining columns count finalized/upcoming contest games for every row, rather than only a participant’s correct selections.
- Configuration locks earlier than the first kickoff if a result is finalized. This conservatively prevents scoring changes to already displayed standings.
- Sample bowl schedule edits lock with contest configuration. Actual scores remain correctable at any time.
- Semifinal pairings are configurable in typed seed bracket data; no separate bracket-definition editor is included in M1.
- Unsaved edits are held in memory. Saving or submitting persists them. Switching participants or reloading discards unsaved edits.
- Final ties are rejected for ordinary bowls as well as CFP because the prototype requires an unambiguous winner.
- No scope expansion into accounts, APIs, hosting, predictions, payment, or notifications.

## Known limitations and proposed M2

No known unresolved scoring, deadline, progression, or persistence regression failures remain in the executed checks. Manual cross-browser/physical-device validation remains advisable; verification used Chromium and jsdom, not Safari, Firefox, or Windows itself.

Local storage is browser/origin specific, editable by users, and can be cleared. Organizer mode and participant selection provide no authentication or authorization. Concurrent tabs are not synchronized or conflict-resolved; use one tab during M1 testing. Schema handling is reset-only rather than a production migration engine. Team and CFP source editing require source changes. Participant display names need not be unique because IDs identify entries. There is no entry export/import or automated backup.

Proposed M2, requiring separate approval: shared backend repository, authentication and organizer authorization, server-enforced clocks and submissions, concurrency handling, audit trail for corrections, durable schema migration and backups, real schedule/team import with verified assignments, broader browser/accessibility testing, and an approved deployment plan. None is implemented or deployed here.
