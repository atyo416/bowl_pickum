import { describe, it, expect } from "vitest";
import { seed, setupSeed } from "./seed";
import { score, leaderboard } from "./scoring";
import { actualWinners, matchup, pickMap } from "./bracket";
import {
  locked,
  saveEntry,
  selectPick,
  setResult,
  updateConfig,
  configLocked,
  validatePicks,
} from "./service";
import { LocalRepository } from "./repository";
import { rounds, type State } from "./model";
const clock = { now: () => new Date("2026-11-01T00:00:00Z") };
function finals() {
  let s = seed();
  for (const g of s.games) s = setResult(s, g.id, 31, 28);
  return s;
}
describe("Independent weighted scoring", () => {
  it.each(rounds)("correct %s uses configured weight", (round) => {
    const s = finals(),
      g = s.games.find((g) => g.round === round)!;
    const e = structuredClone(s.entries[0]);
    e.bowlSubmission = { picks: [], submittedAt: "" };
    e.cfpSubmission = { picks: [], submittedAt: "" };
    e[g.category === "bowl" ? "bowlSubmission" : "cfpSubmission"]!.picks = [
      {
        entryId: e.id,
        gameId: g.id,
        predictedWinnerTeamId: actualWinners(s)[g.id],
      },
    ];
    expect(score(s, e).total).toBe(s.contest.pointsByRound[round]);
  });
  it("perfect CFP earns 22 and separates bowls", () => {
    const s = finals();
    expect(score(s, s.entries[0])).toMatchObject({
      cfpPoints: 22,
      bowlPoints: 8,
      total: 30,
    });
  });
  it("wrong and missing picks score zero", () => {
    const s = finals();
    expect(score(s, s.entries[2]).total).toBe(0);
    expect(score(s, s.entries[4]).total).toBe(0);
  });
  it("correct champion earns points despite different predicted opponent", () => {
    const s = finals(),
      e = structuredClone(s.entries[0]);
    const q = selectPick(s, e.picks, e.id, "q2", "t7");
    const changed = selectPick(s, q, e.id, "s2", "t7");
    e.cfpSubmission!.picks = selectPick(s, changed, e.id, "champ", "t1").filter(
      (p) => s.games.find((g) => g.id === p.gameId)!.category === "cfp",
    );
    expect(
      e.cfpSubmission!.picks.find((p) => p.gameId === "champ")!
        .predictedWinnerTeamId,
    ).toBe("t1");
    expect(score(s, e).cfpPoints).toBe(17);
  });
  it("duplicate picks never double score and validation rejects them", () => {
    const s = finals(),
      e = structuredClone(s.entries[0]);
    e.cfpSubmission!.picks.push(e.cfpSubmission!.picks[0]);
    expect(score(s, e).cfpPoints).toBe(22);
    expect(() => validatePicks(s, e.cfpSubmission!.picks, e.id)).toThrow(
      "Duplicate",
    );
  });
});
describe("Bracket progression", () => {
  it("uses explicit first-round sources", () => {
    const s = seed();
    expect(
      matchup(
        s,
        s.games.find((g) => g.id === "q1")!,
        { f4: "t9" },
      ),
    ).toEqual(["t1", "t9"]);
  });
  it("clears invalid dependent picks but preserves valid downstream picks", () => {
    const s = seed(),
      e = s.entries[0];
    let p = selectPick(s, e.picks, e.id, "q1", "t8");
    p = selectPick(s, p, e.id, "s1", "t8");
    p = selectPick(s, p, e.id, "champ", "t8");
    p = selectPick(s, p, e.id, "f4", "t9");
    expect(pickMap(p).q1).toBeUndefined();
    expect(pickMap(p).s1).toBeUndefined();
    expect(pickMap(p).champ).toBeUndefined();
    expect(pickMap(p).q2).toBe("t2");
    expect(pickMap(selectPick(s, e.picks, e.id, "f4", "t9")).champ).toBe("t1");
  });
  it("rejects impossible paths and incomplete submissions", () => {
    const s = seed(),
      e = s.entries[0];
    expect(() =>
      saveEntry(
        s,
        e.id,
        "cfp",
        [{ entryId: e.id, gameId: "champ", predictedWinnerTeamId: "t12" }],
        52,
        true,
        clock,
      ),
    ).toThrow();
    expect(() => saveEntry(s, e.id, "cfp", [], 52, true, clock)).toThrow();
  });
  it("actual result corrections do not touch participant picks and reopen affected results", () => {
    const s = finals(),
      before = structuredClone(s.entries);
    const next = setResult(s, "f4", 0, 7);
    expect(next.entries).toEqual(before);
    expect(next.games.find((g) => g.id === "q1")!.status).toBe("upcoming");
    expect(next.games.find((g) => g.id === "champ")!.status).toBe("upcoming");
  });
});
describe("Deadlines and snapshot isolation", () => {
  it.each(["bowl", "cfp"] as const)(
    "%s locks at exact timestamp on service mutation",
    (section) => {
      const s = seed();
      s.simulatedNow =
        s.contest[section === "bowl" ? "bowlDeadline" : "cfpDeadline"];
      expect(locked(s, section, clock)).toBe(true);
      expect(() =>
        saveEntry(s, "e1", section, [], undefined, false, clock),
      ).toThrow("deadline");
    },
  );
  it("draft save preserves submitted version through lock", () => {
    const s = seed(),
      e = s.entries[0],
      old = structuredClone(e.bowlSubmission);
    const next = saveEntry(s, e.id, "bowl", [], undefined, false, clock);
    expect(next.entries[0].bowlSubmission).toEqual(old);
    next.simulatedNow = next.contest.bowlDeadline;
    expect(() =>
      saveEntry(next, e.id, "bowl", [], undefined, true, clock),
    ).toThrow();
    expect(score(next, next.entries[0]).bowlPoints).toBe(2);
  });
  it("independent deadlines", () => {
    const s = seed();
    s.simulatedNow = s.contest.bowlDeadline;
    expect(locked(s, "bowl", clock)).toBe(true);
    expect(locked(s, "cfp", clock)).toBe(false);
  });
  it("scoring locks at first kickoff and remains locked after contest start", () => {
    const s = setupSeed();
    expect(configLocked(s, clock)).toBe(false);
    s.simulatedNow = s.games[0].scheduledKickoff;
    expect(() => updateConfig(s, s.contest, clock)).toThrow("locked");
    s.simulatedNow = "2026-11-01T00:00:00Z";
    s.contest.status = "started";
    expect(configLocked(s, clock)).toBe(true);
  });
  it("rejects negative and fractional tiebreakers", () => {
    const s = seed();
    for (const n of [-1, 2.5])
      expect(() => saveEntry(s, "e1", "cfp", [], n, false, clock)).toThrow(
        "whole",
      );
  });
});
describe("Leaderboard", () => {
  it("sorts weighted totals and ignores tiebreaker until final", () => {
    const s = seed();
    const r = leaderboard(s);
    expect(r[0].total).toBe(6);
    expect(r[0].rank).toBe(1);
    expect(r[1].rank).toBe(1);
    expect(r[2].total).toBeLessThanOrEqual(r[1].total);
  });
  it("championship tiebreaker resolves equal totals", () => {
    const s = finals();
    const rows = leaderboard(s);
    expect(rows[0].displayName).toBe("Jordan Lee");
    expect(rows[0].error).toBe(3);
    expect(rows.find((x) => x.id === "p1")!.error).toBe(7);
  });
  it("equal errors share competition ranks and missing prediction goes last", () => {
    const s = finals();
    s.entries[1].cfpSubmission!.championshipTotalPrediction = 66;
    const rows = leaderboard(s);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(1);
    expect(rows[2].rank).toBe(3);
    s.entries[1].cfpSubmission!.championshipTotalPrediction = undefined;
    expect(leaderboard(s)[0].id).toBe("p1");
  });
  it("correcting final scores recalculates tiebreaker", () => {
    const s = finals();
    expect(leaderboard(setResult(s, "champ", 30, 22))[0].id).toBe("p1");
  });
  it("configuration changes before lock derive scores anew", () => {
    const s = setupSeed();
    const c = structuredClone(s.contest);
    c.pointsByRound.cfpChampionship = 10;
    const changed = updateConfig(s, c, clock);
    let result: State = changed;
    for (const g of result.games) result = setResult(result, g.id, 31, 28);
    expect(score(result, result.entries[0]).cfpPoints).toBe(28);
  });
});
describe("Persistence and validation", () => {
  it("persists entries, independent participants, weights and deadlines", () => {
    localStorage.clear();
    const r = new LocalRepository(localStorage);
    let s = setupSeed();
    s.contest.pointsByRound.bowl = 3;
    s = saveEntry(
      s,
      "e5",
      "bowl",
      [{ entryId: "e5", gameId: "b1", predictedWinnerTeamId: "t12" }],
      undefined,
      false,
      clock,
    );
    r.save(s);
    const loaded = new LocalRepository(localStorage).load();
    expect(loaded).toEqual(s);
    expect(loaded.entries[0].picks[0].predictedWinnerTeamId).toBe("t1");
    expect(
      loaded.entries[4].picks.find((p) => p.gameId === "b1")!
        .predictedWinnerTeamId,
    ).toBe("t12");
  });
  it.each([
    [NaN, 2],
    [-1, 2],
    [2.5, 1],
    [7, 7],
  ])("rejects invalid final score %s : %s", (a, b) => {
    expect(() => setResult(seed(), "f1", a, b)).toThrow();
  });
  it("rejects wrong entry IDs and unknown teams", () => {
    const s = seed();
    expect(() =>
      validatePicks(
        s,
        [{ entryId: "other", gameId: "b1", predictedWinnerTeamId: "t1" }],
        "e1",
      ),
    ).toThrow();
    expect(() => selectPick(s, [], "e1", "b1", "unknown")).toThrow();
  });
  it("unknown storage versions require explicit reset", () => {
    localStorage.setItem("broken", JSON.stringify({ version: 9 }));
    const r = new LocalRepository(localStorage, "broken");
    expect(() => r.load()).toThrow("incompatible");
    r.reset();
    expect(r.load().version).toBe(1);
  });
});
