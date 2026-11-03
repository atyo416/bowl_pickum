import { type State, type Pick, defaultPointsByRound } from "./model";
import { matchup, orderedGames } from "./bracket";
export function seed(): State {
  const createdAt = "2026-11-01T12:00:00Z";
  const names = [
    "Northbridge Bears",
    "Cedar State Foxes",
    "Pacific Crest Orcas",
    "Redwood Owls",
    "Lakeview Wolves",
    "Prairie Tech Bison",
    "Summit Eagles",
    "Coastal Sharks",
    "Ironwood Hawks",
    "Mesa Mustangs",
    "Valley Rams",
    "Evergreen Elk",
  ];
  const teams = names.map((name, i) => ({
    id: `t${i + 1}`,
    name,
    seed: i + 1,
  }));
  const slots: State["slots"] = [];
  const add = (
    gameId: string,
    round: State["slots"][number]["round"],
    sourceA: State["slots"][number]["sourceA"],
    sourceB: State["slots"][number]["sourceB"],
  ) => slots.push({ gameId, round, sourceA, sourceB, pointCategory: round });
  [
    [5, 12],
    [6, 11],
    [7, 10],
    [8, 9],
  ].forEach(([a, b], i) =>
    add(`f${i + 1}`, "cfpFirstRound", { teamId: `t${a}` }, { teamId: `t${b}` }),
  );
  [4, 3, 2, 1].forEach((f, i) =>
    add(
      `q${i + 1}`,
      "cfpQuarterfinal",
      { teamId: `t${i + 1}` },
      { winnerOf: `f${f}` },
    ),
  );
  add("s1", "cfpSemifinal", { winnerOf: "q1" }, { winnerOf: "q4" });
  add("s2", "cfpSemifinal", { winnerOf: "q2" }, { winnerOf: "q3" });
  add("champ", "cfpChampionship", { winnerOf: "s1" }, { winnerOf: "s2" });
  const bowls = [
    "Lantern",
    "Canyon",
    "Harbor",
    "Orchard",
    "Alpine",
    "Founders",
    "Riverbend",
    "Starlight",
  ];
  let s: State = {
    version: 1,
    contest: {
      id: "contest-2026",
      name: "The Bowl Room",
      season: "2026–27",
      timezone: "America/New_York",
      bowlDeadline: "2026-12-12T16:00:00Z",
      cfpDeadline: "2026-12-18T23:00:00Z",
      pointsByRound: { ...defaultPointsByRound },
      status: "started",
    },
    teams,
    slots,
    participants: [
      "Alex Morgan",
      "Jordan Lee",
      "Casey Brooks",
      "Taylor Reed",
      "Sam Parker",
    ].map((displayName, i) => ({ id: `p${i + 1}`, displayName, createdAt })),
    games: [
      ...bowls.map((name, i) => ({
        id: `b${i + 1}`,
        name: `${name} Bowl`,
        category: "bowl" as const,
        round: "bowl" as const,
        scheduledKickoff: `2026-12-${13 + i}T19:00:00Z`,
        teamAId: `t${i + 1}`,
        teamBId: `t${12 - i}`,
        status: i < 2 ? ("final" as const) : ("upcoming" as const),
        ...(i < 2 ? { actualScoreA: 28, actualScoreB: 21 } : {}),
      })),
      ...slots.map((slot, i) => ({
        id: slot.gameId,
        name:
          slot.gameId === "champ"
            ? "National Championship"
            : `CFP ${slot.gameId.toUpperCase()}`,
        category: "cfp" as const,
        round: slot.round,
        scheduledKickoff:
          slot.round === "cfpFirstRound"
            ? "2026-12-19T17:00:00Z"
            : slot.round === "cfpQuarterfinal"
              ? "2027-01-01T18:00:00Z"
              : slot.round === "cfpSemifinal"
                ? "2027-01-09T18:00:00Z"
                : "2027-01-19T00:30:00Z",
        status: i < 4 ? ("final" as const) : ("upcoming" as const),
        ...(i < 4 ? { actualScoreA: 31, actualScoreB: 24 } : {}),
      })),
    ],
    entries: [],
    simulatedNow: "2026-12-10T17:00:00Z",
  };
  const full = (side: number, entryId: string) => {
    const p: Pick[] = [];
    const w: Record<string, string> = {};
    for (const g of orderedGames(s)) {
      const options = matchup(s, g, w);
      const team = options[side]!;
      p.push({ entryId, gameId: g.id, predictedWinnerTeamId: team });
      w[g.id] = team;
    }
    return p;
  };
  s.entries = s.participants.map((p, i) => {
    const id = `e${i + 1}`,
      all = full(i === 2 ? 1 : 0, id);
    return {
      id,
      contestId: s.contest.id,
      participantId: p.id,
      createdAt,
      updatedAt: createdAt,
      picks: i === 4 ? all.slice(0, 3) : all,
      championshipTotalPrediction: i === 1 ? 62 : 52,
      ...(i < 4
        ? {
            bowlSubmittedAt: createdAt,
            bowlSubmission: {
              picks: all.filter((x) => x.gameId.startsWith("b")),
              submittedAt: createdAt,
            },
          }
        : {}),
      ...(i < 3
        ? {
            cfpSubmittedAt: createdAt,
            cfpSubmission: {
              picks: all.filter((x) => !x.gameId.startsWith("b")),
              submittedAt: createdAt,
              championshipTotalPrediction: i === 1 ? 62 : 52,
            },
          }
        : {}),
    };
  });
  return s;
}
export function setupSeed(): State {
  const s = seed();
  return {
    ...s,
    contest: { ...s.contest, status: "setup" },
    games: s.games.map((g) => ({
      ...g,
      status: "upcoming",
      actualScoreA: undefined,
      actualScoreB: undefined,
    })),
  };
}
