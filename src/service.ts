import {
  type State,
  type Clock,
  type Round,
  type Pick,
  type Game,
  rounds,
} from "./model";
import {
  normalize,
  matchup,
  pickMap,
  actualWinners,
  orderedGames,
} from "./bracket";
export const now = (s: State, c: Clock) =>
  s.simulatedNow ? new Date(s.simulatedNow) : c.now();
export const locked = (s: State, section: "bowl" | "cfp", c: Clock) =>
  now(s, c).getTime() >=
  Date.parse(s.contest[section === "bowl" ? "bowlDeadline" : "cfpDeadline"]);
export const configLocked = (s: State, c: Clock) =>
  s.contest.status === "started" ||
  s.games.some(
    (g) =>
      Date.parse(g.scheduledKickoff) <= now(s, c).getTime() ||
      g.status === "final",
  );
const integer = (n: unknown) =>
  typeof n === "number" && Number.isInteger(n) && n >= 0;
export function validatePicks(s: State, p: Pick[], entryId: string) {
  if (new Set(p.map((x) => x.gameId)).size !== p.length)
    throw Error("Duplicate game picks");
  if (
    p.some((x) => x.entryId !== entryId) ||
    normalize(s, p).length !== p.length
  )
    throw Error("Invalid team or impossible bracket path");
}
export function saveEntry(
  s: State,
  id: string,
  section: "bowl" | "cfp",
  picks: Pick[],
  prediction: number | undefined,
  submit: boolean,
  c: Clock,
): State {
  if (locked(s, section, c)) throw Error("The submission deadline has passed");
  const e = s.entries.find((x) => x.id === id);
  if (!e) throw Error("Entry not found");
  validatePicks(s, picks, id);
  const games = s.games.filter((g) => g.category === section);
  if (picks.some((p) => !games.some((g) => g.id === p.gameId)))
    throw Error("Wrong submission section");
  if (prediction !== undefined && !integer(prediction))
    throw Error("Tiebreaker must be a nonnegative whole number");
  if (
    submit &&
    (picks.length !== games.length ||
      (section === "cfp" && prediction === undefined))
  )
    throw Error("Complete every pick and the CFP tiebreaker before submitting");
  const timestamp = now(s, c).toISOString();
  const next = {
    ...e,
    picks: [
      ...e.picks.filter((p) => !games.some((g) => g.id === p.gameId)),
      ...structuredClone(picks),
    ],
    updatedAt: timestamp,
    ...(section === "cfp" ? { championshipTotalPrediction: prediction } : {}),
  };
  if (submit) {
    const snap = {
      picks: structuredClone(picks),
      championshipTotalPrediction: prediction,
      submittedAt: timestamp,
    };
    if (section === "bowl") {
      next.bowlSubmission = snap;
      next.bowlSubmittedAt = timestamp;
    } else {
      next.cfpSubmission = snap;
      next.cfpSubmittedAt = timestamp;
    }
  }
  return { ...s, entries: s.entries.map((x) => (x.id === id ? next : x)) };
}
export function updateConfig(
  s: State,
  contest: State["contest"],
  c: Clock,
): State {
  if (configLocked(s, c)) throw Error("Contest configuration is locked");
  if (rounds.some((r) => !integer(contest.pointsByRound[r])))
    throw Error("Weights must be nonnegative whole numbers");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: contest.timezone });
  } catch {
    throw Error("Invalid timezone");
  }
  for (const section of ["bowl", "cfp"] as const) {
    const d = Date.parse(
      contest[section === "bowl" ? "bowlDeadline" : "cfpDeadline"],
    );
    const earliest = Math.min(
      ...s.games
        .filter((g) => g.category === section)
        .map((g) => Date.parse(g.scheduledKickoff)),
    );
    if (
      !/(Z|[+-]\d\d:\d\d)$/.test(
        contest[section === "bowl" ? "bowlDeadline" : "cfpDeadline"],
      ) ||
      !Number.isFinite(d) ||
      d >= earliest
    )
      throw Error("Each deadline must precede its earliest game");
  }
  return { ...s, contest };
}
export function setResult(
  s: State,
  id: string,
  a: number,
  b: number,
  final = true,
): State {
  if (!integer(a) || !integer(b) || a === b)
    throw Error(
      "Final scores must be nonnegative whole numbers and cannot be tied",
    );
  const g = s.games.find((x) => x.id === id);
  if (!g) throw Error("Game not found");
  if (final && matchup(s, g, actualWinners(s)).some((x) => !x))
    throw Error("Finalize feeder games first");
  let next = {
    ...s,
    games: s.games.map((x) =>
      x.id === id
        ? {
            ...x,
            status: final ? ("final" as const) : ("upcoming" as const),
            actualScoreA: final ? a : undefined,
            actualScoreB: final ? b : undefined,
          }
        : x,
    ),
  };
  const old = actualWinners(s),
    winners: Record<string, string> = {};
  next = {
    ...next,
    games: orderedGames(next).map((game) => {
      if (game.category === "cfp" && game.id !== id) {
        const before = matchup(s, game, old),
          after = matchup(next, game, winners);
        if (before.some((x, i) => x !== after[i]))
          game = {
            ...game,
            status: "upcoming",
            actualScoreA: undefined,
            actualScoreB: undefined,
          };
      }
      const [ta, tb] = matchup(next, game, winners);
      if (game.status === "final" && ta && tb)
        winners[game.id] = game.actualScoreA! > game.actualScoreB! ? ta : tb;
      return game;
    }),
  };
  return next;
}
export function updateBowl(s: State, g: Game, c: Clock): State {
  if (configLocked(s, c)) throw Error("Game configuration is locked");
  if (
    g.category !== "bowl" ||
    !g.name.trim() ||
    !g.teamAId ||
    !g.teamBId ||
    g.teamAId === g.teamBId ||
    ![g.teamAId, g.teamBId].every((id) => s.teams.some((t) => t.id === id)) ||
    !Number.isFinite(Date.parse(g.scheduledKickoff)) ||
    Date.parse(g.scheduledKickoff) <= Date.parse(s.contest.bowlDeadline)
  )
    throw Error(
      "Provide a name, two different teams, and a kickoff after the bowl deadline",
    );
  return {
    ...s,
    games: s.games.some((x) => x.id === g.id)
      ? s.games.map((x) => (x.id === g.id ? g : x))
      : [...s.games, g],
  };
}
export function selectPick(
  s: State,
  p: Pick[],
  entryId: string,
  gameId: string,
  teamId: string,
): Pick[] {
  const game = s.games.find((g) => g.id === gameId);
  if (!game || !matchup(s, game, pickMap(p)).includes(teamId))
    throw Error("Invalid selection");
  return normalize(s, [
    ...p.filter((x) => x.gameId !== gameId),
    { entryId, gameId, predictedWinnerTeamId: teamId },
  ]);
}
