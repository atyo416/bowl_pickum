import type { State, Pick, Game, Source } from "./model";
export function actualWinners(s: State): Record<string, string> {
  const winners: Record<string, string> = {};
  for (const g of orderedGames(s)) {
    const [a, b] = matchup(s, g, winners);
    if (
      g.status === "final" &&
      a &&
      b &&
      g.actualScoreA !== undefined &&
      g.actualScoreB !== undefined &&
      g.actualScoreA !== g.actualScoreB
    )
      winners[g.id] = g.actualScoreA > g.actualScoreB ? a : b;
  }
  return winners;
}
export function orderedGames(s: State): Game[] {
  const out: Game[] = [];
  const pending = [...s.games];
  while (pending.length) {
    const i = pending.findIndex((g) => {
      const slot = s.slots.find((x) => x.gameId === g.id);
      return (
        !slot ||
        [slot.sourceA, slot.sourceB].every(
          (x) => "teamId" in x || out.some((y) => y.id === x.winnerOf),
        )
      );
    });
    if (i < 0) throw Error("Invalid bracket definition");
    out.push(...pending.splice(i, 1));
  }
  return out;
}
export function matchup(
  s: State,
  g: Game,
  w: Record<string, string>,
): (string | undefined)[] {
  const slot = s.slots.find((x) => x.gameId === g.id);
  const resolve = (x: Source) => ("teamId" in x ? x.teamId : w[x.winnerOf]);
  return slot
    ? [resolve(slot.sourceA), resolve(slot.sourceB)]
    : [g.teamAId, g.teamBId];
}
export const pickMap = (p: Pick[]) =>
  Object.fromEntries(p.map((x) => [x.gameId, x.predictedWinnerTeamId]));
export function normalize(s: State, p: Pick[]): Pick[] {
  const valid: Pick[] = [];
  const w: Record<string, string> = {};
  for (const g of orderedGames(s)) {
    const pick = p.find((x) => x.gameId === g.id);
    if (pick && matchup(s, g, w).includes(pick.predictedWinnerTeamId)) {
      valid.push(pick);
      w[g.id] = pick.predictedWinnerTeamId;
    }
  }
  return valid;
}
