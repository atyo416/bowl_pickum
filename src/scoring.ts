import type { State, Entry } from "./model";
import { actualWinners } from "./bracket";
export function score(s: State, e: Entry) {
  const w = actualWinners(s);
  const p = [
    ...(e.bowlSubmission?.picks ?? []),
    ...(e.cfpSubmission?.picks ?? []),
  ];
  let bowlPoints = 0,
    cfpPoints = 0,
    correctBowl = 0,
    correctCfp = 0;
  for (const g of s.games) {
    if (
      w[g.id] &&
      p.find((x) => x.gameId === g.id)?.predictedWinnerTeamId === w[g.id]
    ) {
      if (g.category === "bowl") {
        correctBowl++;
        bowlPoints += s.contest.pointsByRound[g.round];
      } else {
        correctCfp++;
        cfpPoints += s.contest.pointsByRound[g.round];
      }
    }
  }
  const champ = s.games.find((g) => g.round === "cfpChampionship");
  const prediction = e.cfpSubmission?.championshipTotalPrediction;
  const error =
    champ?.status === "final" && prediction !== undefined
      ? Math.abs(prediction - champ.actualScoreA! - champ.actualScoreB!)
      : undefined;
  return {
    bowlPoints,
    cfpPoints,
    total: bowlPoints + cfpPoints,
    correctBowl,
    correctCfp,
    prediction,
    error,
  };
}
export function leaderboard(s: State) {
  const active = s.games.some(
    (g) => g.round === "cfpChampionship" && g.status === "final",
  );
  const rows = s.participants
    .map((p) => ({
      ...p,
      ...score(
        s,
        s.entries.find((e) => e.participantId === p.id)!,
      ),
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        (active ? (a.error ?? Infinity) - (b.error ?? Infinity) : 0) ||
        a.displayName.localeCompare(b.displayName),
    );
  let rank = 1;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (i && !(prev.total === r.total && (!active || prev.error === r.error)))
      rank = i + 1;
    return { ...r, rank };
  });
}
