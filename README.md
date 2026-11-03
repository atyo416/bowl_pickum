# The Bowl Room — M1

Local college football bowl pick’em prototype for the fictional 2026–27 season. React + TypeScript + Vite; browser localStorage; no API keys, server accounts, or paid services.

## Windows / PowerShell quick start

Install Node.js 22 LTS (or a newer supported LTS) from https://nodejs.org. Extract the source archive, then open PowerShell in the extracted folder:

```powershell
cd .\bowl_pickum-main
npm.cmd ci
npm.cmd run dev
```

The GitHub **Code → Download ZIP** archive extracts to `bowl_pickum-main`. If you cloned the repository instead, use `cd .\bowl_pickum`.

Open the localhost URL printed by Vite (normally http://localhost:5173). Keep the terminal open. Use Ctrl+C to stop. `npm.cmd` avoids PowerShell execution-policy issues with npm.ps1.

```powershell
npm.cmd test
npm.cmd run build
```

The build goes to `dist`. Serve through Vite; do not open index.html using file://. Internet access is needed only to install dependencies. The running application uses no external services, fonts, or assets. If port 5173 is occupied, Vite chooses another port; use its printed URL. Browser storage is scoped to the origin, including port.

## Walkthrough

- **Overview:** choose any of five local participants; see progress, deadlines, and scoring rules.
- **Bowl picks:** select all included winners, then Save draft or Submit bowls.
- **CFP bracket:** select first-round winners, quarterfinals, semifinals, and champion. Seeds 1–4 have byes. Enter a nonnegative integer championship combined-points prediction and Submit bracket.
- **Leaderboard:** submitted snapshots score against final results; drafts never contribute. CFP weights are 1 / 2 / 3 / 4. A perfect playoff is 22 points.
- **Organizer:** explicitly local testing controls; no security boundary. Edit results, inspect snapshots, create participants, configure a simulated clock, and reset.

Changing early predictions clears only invalid downstream picks. Bowl and CFP snapshots submit independently. Save draft does not replace an earlier submission. At the exact deadline the relevant section locks and displays the submitted version; unsubmitted drafts are excluded. Save or submit before switching participants or refreshing; in-memory edits are not autosaved.

## Repeatable demonstrations

The default seed intentionally combines partial results with a clock set to December 10, before both deadlines, so results and editable entries can be explored together. It is a synthetic testing scenario, not a chronological record. Scoring configuration is already locked because results exist and contest status is started.

1. Click **Reset demonstration data** to restore eight bowls, twelve CFP teams, five participants, six final games, partial entries, and an initial points tie.
2. Click **Finalize demo (tiebreaker)**. All games finalize with the first matchup team winning. Championship score is 31–28 (59 combined). Alex and Jordan both earn 30 points. Jordan’s 62 prediction has error 3; Alex’s 52 has error 7, so Jordan ranks first.
3. Correct championship score to 30–22. Alex’s prediction is exact, and Alex moves ahead. Scores are always derived.
4. For deadline testing, set the clock to `2026-12-12T16:00:00Z`: bowls lock, CFP stays open. Set it to `2026-12-18T23:00:00Z`: CFP and tiebreaker lock too. One second before either timestamp remains editable.
5. **Reset to pre-contest setup** removes final results and sets status to setup. Change scoring weights and deadlines, edit or add bowls, save configuration, then Begin contest. Configuration locks even if the testing clock is rewound.
6. Changing a finalized advancing winner reopens affected dependent results. Re-enter those results in round order. Participant predictions stay unchanged.

Destructive resets ask for confirmation and replace all local contest data. Clearing browser site storage also removes entries. Unsupported schema versions require an explicit reset; no silent migration or deletion.

## Architecture

- `model.ts`: typed contest, teams, games, sources, bracket slots, entries, picks, snapshots, clock.
- `bracket.ts`: explicit source graph, topological ordering, independent actual progression, prediction normalization.
- `service.ts`: submission, deadline, configuration, result, and schedule validation.
- `scoring.ts`: deterministic scoring and competition rankings derived from configuration, submitted snapshots, and results.
- `seed.ts`: repeatable fictional demonstrations; semifinal source relationships are data, not inferred list order.
- `repository.ts`: Repository interface with versioned LocalRepository adapter.
- `App.tsx`, `style.css`: screens, feedback, responsive presentation.
- `logic.test.ts`, `App.test.tsx`: Vitest regression tests and React Testing Library workflows.

See `ENGINEERING_REPORT.md` for verification, limitations, assumptions, and proposed M2 work. No M2 deployment or hosting is included.
