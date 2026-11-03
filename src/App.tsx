import { useEffect, useState } from "react";
import {
  type State,
  type Pick,
  type Game,
  rounds,
  labels,
  systemClock,
} from "./model";
import { LocalRepository } from "./repository";
import { seed, setupSeed } from "./seed";
import { actualWinners, matchup, pickMap } from "./bracket";
import {
  locked,
  configLocked,
  saveEntry,
  selectPick,
  updateConfig,
  setResult,
  updateBowl,
} from "./service";
import { leaderboard } from "./scoring";
const repo = new LocalRepository(localStorage);
export default function App() {
  const [initial] = useState(() => {
    try {
      return { state: repo.load(), error: "" };
    } catch (e) {
      return { state: seed(), error: (e as Error).message };
    }
  });
  const [s, setS] = useState<State>(initial.state),
    [recoveryNeeded, setRecoveryNeeded] = useState(!!initial.error),
    [error, setError] = useState(initial.error),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState("Overview"),
    [participant, setParticipant] = useState("p1"),
    [tick, setTick] = useState(0);
  const e = s.entries.find((x) => x.participantId === participant)!;
  const [picks, setPicks] = useState<Pick[]>(e.picks),
    [prediction, setPrediction] = useState(
      e.championshipTotalPrediction?.toString() ?? "",
    );
  useEffect(() => {
    const timer = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  void tick;
  useEffect(() => {
    setPicks(e.picks);
    setPrediction(e.championshipTotalPrediction?.toString() ?? "");
  }, [e]);
  const act = (fn: () => State, message: string) => {
    try {
      if (
        recoveryNeeded &&
        message !== "Demo reset" &&
        message !== "Setup reset"
      )
        throw Error(initial.error);
      const next = fn();
      repo.save(next);
      setS(next);
      setRecoveryNeeded(false);
      setError("");
      setNotice(message);
    } catch (ex) {
      setError((ex as Error).message);
      setNotice("");
    }
  };
  const date = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: s.contest.timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  const name = (id?: string) =>
    s.teams.find((t) => t.id === id)?.name ?? "Awaiting winner";
  const displayPicks = (["bowl", "cfp"] as const).flatMap((section) =>
    locked(s, section, systemClock)
      ? (e[section === "bowl" ? "bowlSubmission" : "cfpSubmission"]?.picks ??
        [])
      : picks.filter((p) =>
          s.games.some((g) => g.id === p.gameId && g.category === section),
        ),
  );
  const count = (section: string) =>
    displayPicks.filter((p) =>
      s.games.some((g) => g.id === p.gameId && g.category === section),
    ).length;
  const saved = (section: "bowl" | "cfp") =>
    e[section === "bowl" ? "bowlSubmission" : "cfpSubmission"];
  const choose = (g: Game, id: string) => {
    try {
      if (locked(s, g.category, systemClock))
        throw Error("The submission deadline has passed");
      setPicks(selectPick(s, picks, e.id, g.id, id));
      setNotice("Selection changed — save a draft or submit to retain it.");
      setError("");
    } catch (ex) {
      setError((ex as Error).message);
    }
  };
  const submit = (section: "bowl" | "cfp", complete: boolean) =>
    act(
      () =>
        saveEntry(
          s,
          e.id,
          section,
          picks.filter((p) =>
            s.games.some((g) => g.id === p.gameId && g.category === section),
          ),
          section === "cfp" && prediction !== ""
            ? Number(prediction)
            : undefined,
          complete,
          systemClock,
        ),
      complete
        ? "Submission accepted. Your submitted version now counts."
        : "Draft saved. Your last submission is unchanged.",
    );
  const card = (g: Game) => {
    const [a, b] = matchup(s, g, pickMap(displayPicks));
    const selected = pickMap(displayPicks)[g.id];
    return (
      <article className={"game " + (selected ? "chosen" : "")} key={g.id}>
        <div className="game-meta">
          <span>{g.name}</span>
          <span>{s.contest.pointsByRound[g.round]} PT</span>
        </div>
        {[a, b].map((id, i) => (
          <button
            key={i}
            disabled={!id || locked(s, g.category, systemClock)}
            aria-pressed={!!id && selected === id}
            className={"team " + (id && selected === id ? "selected" : "")}
            onClick={() => id && choose(g, id)}
          >
            <span className="seed">
              {s.teams.find((t) => t.id === id)?.seed ?? "—"}
            </span>
            <span>{name(id)}</span>
            <span>{id && selected === id ? "✓" : "○"}</span>
          </button>
        ))}
        <small>
          {date(g.scheduledKickoff)} ·{" "}
          {selected ? "Pick selected" : "Pick needed"}
        </small>
      </article>
    );
  };
  const controls = (section: "bowl" | "cfp") => (
    <div className="savebar">
      <span>
        {count(section)} /{" "}
        {s.games.filter((g) => g.category === section).length} picks ·{" "}
        {saved(section) ? "Submitted version saved" : "Draft only"} ·{" "}
        {locked(s, section, systemClock)
          ? "Locked · showing submitted version"
          : "Open"}
      </span>
      <button
        disabled={locked(s, section, systemClock)}
        onClick={() => submit(section, false)}
      >
        Save draft
      </button>
      <button
        className="primary"
        disabled={locked(s, section, systemClock)}
        onClick={() => submit(section, true)}
      >
        Submit {section === "cfp" ? "bracket" : "bowls"} ↗
      </button>
    </div>
  );
  return (
    <>
      <header>
        <a className="brand" href="#" onClick={() => setTab("Overview")}>
          <span className="logo">B</span> BOWL ROOM{" "}
          <span className="season">2026 / 27</span>
        </a>
        <div className="local">● LOCAL PROTOTYPE</div>
      </header>
      <div className="shell">
        <aside>
          <div className="eyebrow">YOUR CONTEST</div>
          {[
            "Overview",
            "Bowl picks",
            "CFP bracket",
            "Leaderboard",
            "Organizer",
          ].map((t, i) => (
            <button
              className={tab === t ? "nav active" : "nav"}
              onClick={() => {
                setTab(t);
                setNotice("");
              }}
              key={t}
            >
              <span aria-hidden="true">{["◫", "☷", "⑂", "▥", "⚙"][i]}</span>
              {t}
            </button>
          ))}
          <div className="sidebar-note">
            M1 TESTING MODE
            <p>
              Fictional teams. Local entries.
              <br />
              Saved on this browser.
            </p>
          </div>
        </aside>
        <main>
          <div className="topline">
            <span>COLLEGE FOOTBALL / {s.contest.season}</span>
            <label>
              Viewing as{" "}
              <select
                aria-label="Participant"
                value={participant}
                onChange={(ev) => setParticipant(ev.target.value)}
              >
                {s.participants.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
          {tab === "Overview" && (
            <>
              <div className="hero">
                <div>
                  <div className="eyebrow">
                    {s.contest.name.toUpperCase()} / POSTSEASON
                  </div>
                  <h1>
                    Your picks.
                    <br />
                    Your path to the title.
                  </h1>
                  <p>
                    {s.games.filter((g) => g.category === "bowl").length} bowls.
                    Twelve playoff teams. One spot at the top.
                    <br />
                    Make your picks and follow every round.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setTab("Bowl picks")}
                  >
                    Make your picks <span>↗</span>
                  </button>
                </div>
                <div className="hero-art">
                  <div className="football">◈</div>
                  <span>THE BOWL ROOM</span>
                  <strong>
                    20<span> / </span>26
                  </strong>
                  <small>POSTSEASON PICK’EM</small>
                </div>
              </div>
              <div className="stats">
                <article>
                  <span>IN THE CONTEST</span>
                  <strong>
                    {s.participants.length} <small>participants</small>
                  </strong>
                </article>
                <article>
                  <span>ON THE SLATE</span>
                  <strong>
                    {s.games.length} <small>games</small>
                  </strong>
                </article>
                <article>
                  <span>UP FOR GRABS</span>
                  <strong>
                    {s.games.reduce(
                      (n, g) => n + s.contest.pointsByRound[g.round],
                      0,
                    )}{" "}
                    <small>total points</small>
                  </strong>
                </article>
              </div>
              <div className="section-title">
                <h2>Your entry</h2>
                <span>
                  {
                    s.participants.find((p) => p.id === participant)
                      ?.displayName
                  }
                </span>
              </div>
              <div className="entry-grid">
                {(["bowl", "cfp"] as const).map((section) => (
                  <article className="panel" key={section}>
                    <div className="eyebrow">
                      {section === "bowl"
                        ? "01 / BOWL PICK SHEET"
                        : "02 / PLAYOFF BRACKET"}
                    </div>
                    <h2>
                      {section === "bowl"
                        ? "Every bowl counts."
                        : "Pick your champion."}
                    </h2>
                    <p>
                      {count(section)} of{" "}
                      {s.games.filter((g) => g.category === section).length}{" "}
                      picks selected
                    </p>
                    <progress
                      value={count(section)}
                      max={s.games.filter((g) => g.category === section).length}
                    />
                    <p className="muted">
                      {saved(section)
                        ? "Submitted · draft edits require resubmission"
                        : "Not submitted"}{" "}
                      · {locked(s, section, systemClock) ? "Locked" : "Open"}
                    </p>
                    <small>
                      Deadline:{" "}
                      {date(
                        s.contest[
                          section === "bowl" ? "bowlDeadline" : "cfpDeadline"
                        ],
                      )}
                    </small>
                    <button
                      className="link"
                      onClick={() =>
                        setTab(
                          section === "bowl" ? "Bowl picks" : "CFP bracket",
                        )
                      }
                    >
                      Open {section === "bowl" ? "pick sheet" : "bracket"} →
                    </button>
                  </article>
                ))}
              </div>
              <section className="panel rules">
                <h2>A simple game. A bigger postseason.</h2>
                <p>
                  Correct bowl picks earn {s.contest.pointsByRound.bowl}{" "}
                  point(s). CFP wins earn{" "}
                  {rounds
                    .slice(1)
                    .map((r) => s.contest.pointsByRound[r])
                    .join(" / ")}{" "}
                  points by round. Every game scores independently. Highest
                  weighted total wins.
                </p>
                <p>
                  Submit bowls and CFP separately before their deadlines. Only
                  your last valid submitted version counts. Championship
                  total-score prediction breaks point ties after the final;
                  equal errors share competition ranks. Deadlines display in{" "}
                  {s.contest.timezone}.
                </p>
              </section>
            </>
          )}
          {tab === "Bowl picks" && (
            <>
              <div className="page-title">
                <div className="eyebrow">01 / YOUR PICK SHEET</div>
                <h1>Make every bowl count.</h1>
                <p>
                  Choose a winner in every included game. Deadline:{" "}
                  {date(s.contest.bowlDeadline)}
                </p>
              </div>
              {controls("bowl")}
              <div className="bowl-grid">
                {s.games.filter((g) => g.category === "bowl").map(card)}
              </div>
            </>
          )}
          {tab === "CFP bracket" && (
            <>
              <div className="page-title">
                <div className="eyebrow">02 / THE ROAD TO THE TITLE</div>
                <h1>Build your playoff.</h1>
                <p>
                  Seeds 1–4 receive byes. No reseeding. Deadline:{" "}
                  {date(s.contest.cfpDeadline)}
                </p>
              </div>
              {controls("cfp")}
              <div className="bracket">
                {rounds.slice(1).map((r) => (
                  <section className="round" key={r}>
                    <div className="round-title">
                      <h3>{labels[r]}</h3>
                      <span>{s.contest.pointsByRound[r]} PT / WIN</span>
                    </div>
                    <div className="round-games">
                      {s.games.filter((g) => g.round === r).map(card)}
                    </div>
                  </section>
                ))}
              </div>
              <div className="panel champion">
                <div>
                  <div className="eyebrow">YOUR NATIONAL CHAMPION</div>
                  <h2>{name(pickMap(displayPicks).champ)}</h2>
                </div>
                <label>
                  Championship combined points
                  <input
                    aria-label="Championship combined points"
                    type="number"
                    min="0"
                    step="1"
                    value={
                      locked(s, "cfp", systemClock)
                        ? (e.cfpSubmission?.championshipTotalPrediction ?? "")
                        : prediction
                    }
                    disabled={locked(s, "cfp", systemClock)}
                    onChange={(ev) => setPrediction(ev.target.value)}
                  />
                  <small>
                    Required for submission · nearest total breaks ties
                  </small>
                </label>
              </div>
            </>
          )}
          {tab === "Leaderboard" && (
            <>
              <div className="page-title">
                <div className="eyebrow">THE STANDINGS</div>
                <h1>Every point matters.</h1>
                <p>
                  Live calculations from submitted picks and finalized results.
                </p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Rank",
                        "Participant",
                        "Bowl ✓",
                        "CFP ✓",
                        "Bowl pts",
                        "CFP pts",
                        "Total",
                        "Completed",
                        "Remaining",
                        "Prediction",
                        "Error",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard(s).map((r) => (
                      <tr
                        key={r.id}
                        className={r.id === participant ? "highlight" : ""}
                      >
                        <td>{r.rank}</td>
                        <td>{r.displayName}</td>
                        <td>{r.correctBowl}</td>
                        <td>{r.correctCfp}</td>
                        <td>{r.bowlPoints}</td>
                        <td>{r.cfpPoints}</td>
                        <td>
                          <strong>{r.total}</strong>
                        </td>
                        <td>
                          {s.games.filter((g) => g.status === "final").length}
                        </td>
                        <td>
                          {s.games.filter((g) => g.status !== "final").length}
                        </td>
                        <td>{r.prediction ?? "—"}</td>
                        <td>{r.error ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                Tiebreaker activates only after the championship is final.
                Drafts do not earn points.
              </p>
            </>
          )}
          {tab === "Organizer" && (
            <Organizer
              key={s.contest.status + s.simulatedNow}
              s={s}
              act={act}
              date={date}
            />
          )}
          <footer>
            THE BOWL ROOM{" "}
            <span>
              2026–27 · Local functional prototype · All teams and results are
              fictional
            </span>
          </footer>
        </main>
      </div>
    </>
  );
}
function Organizer({
  s,
  act,
  date,
}: {
  s: State;
  act: (fn: () => State, message: string) => void;
  date: (x: string) => string;
}) {
  const [config, setConfig] = useState(structuredClone(s.contest)),
    [time, setTime] = useState(s.simulatedNow ?? ""),
    [newName, setNewName] = useState("");
  const lockedConfig = configLocked(s, systemClock);
  return (
    <>
      <div className="page-title">
        <div className="eyebrow">LOCAL ORGANIZER TESTING MODE</div>
        <h1>Manage the contest.</h1>
        <p>
          Local controls available to anyone using this browser. This is not
          secure administration.
        </p>
      </div>
      <section className="panel">
        <h2>Testing clock & demonstrations</h2>
        <p>
          Current clock: {date(s.simulatedNow ?? new Date().toISOString())}{" "}
          {s.simulatedNow ? "(simulated)" : "(real time)"}
        </p>
        <label>
          Simulated time (timezone-aware ISO)
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="2026-12-10T17:00:00Z"
          />
        </label>
        <div className="actions">
          <button
            onClick={() =>
              act(() => {
                if (
                  !/(Z|[+-]\d\d:\d\d)$/.test(time) ||
                  !Number.isFinite(Date.parse(time))
                )
                  throw Error("Use a timezone-aware ISO timestamp");
                return { ...s, simulatedNow: new Date(time).toISOString() };
              }, "Testing clock updated")
            }
          >
            Apply time
          </button>
          <button
            onClick={() =>
              act(
                () => ({ ...s, simulatedNow: undefined }),
                "Real clock enabled",
              )
            }
          >
            Use real time
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "Replace all local entries and results with demonstration data?",
                )
              )
                act(() => seed(), "Demo reset");
            }}
          >
            Reset demonstration data
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "Reset all data to an unstarted contest with no final results?",
                )
              )
                act(() => setupSeed(), "Setup reset");
            }}
          >
            Reset to pre-contest setup
          </button>
          <button
            onClick={() =>
              act(() => {
                let next = structuredClone(s);
                for (const g of next.games)
                  next = setResult(
                    next,
                    g.id,
                    g.id === "champ" ? 31 : 28,
                    g.id === "champ" ? 28 : 21,
                  );
                return next;
              }, "All demonstration results finalized; championship total is 59")
            }
          >
            Finalize demo (tiebreaker)
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>
          Contest configuration{" "}
          <span className="badge">{lockedConfig ? "Locked" : "Editable"}</span>
        </h2>
        <p>
          Configuration locks permanently on start, the first kickoff, or a
          finalized result. Reset to setup to test changes.
        </p>
        <fieldset disabled={lockedConfig}>
          <div className="form-grid">
            <label>
              Contest name
              <input
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
              />
            </label>
            <label>
              Timezone
              <input
                value={config.timezone}
                onChange={(e) =>
                  setConfig({ ...config, timezone: e.target.value })
                }
              />
            </label>
            {(["bowl", "cfp"] as const).map((section) => {
              const key = section === "bowl" ? "bowlDeadline" : "cfpDeadline";
              return (
                <label key={key}>
                  {section.toUpperCase()} deadline (ISO)
                  <input
                    value={config[key]}
                    onChange={(e) =>
                      setConfig({ ...config, [key]: e.target.value })
                    }
                  />
                </label>
              );
            })}
            {rounds.map((r) => (
              <label key={r}>
                {labels[r]} points
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={config.pointsByRound[r]}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pointsByRound: {
                        ...config.pointsByRound,
                        [r]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="actions">
            <button
              onClick={() =>
                act(
                  () => updateConfig(s, config, systemClock),
                  "Configuration saved",
                )
              }
            >
              Save configuration
            </button>
            <button
              onClick={() =>
                act(
                  () => ({
                    ...updateConfig(s, config, systemClock),
                    contest: { ...config, status: "started" },
                  }),
                  "Contest started; configuration locked",
                )
              }
            >
              Begin contest
            </button>
          </div>
        </fieldset>
      </section>
      <section className="panel">
        <h2>Sample bowl schedule</h2>
        <p>
          Game definitions can be changed only before contest lock. Team options
          are fictional seed teams.
        </p>
        {s.games
          .filter((g) => g.category === "bowl")
          .map((g) => (
            <BowlEditor
              key={g.id}
              g={g}
              s={s}
              disabled={lockedConfig}
              save={(game) =>
                act(() => updateBowl(s, game, systemClock), "Bowl saved")
              }
            />
          ))}
        <button
          disabled={lockedConfig}
          onClick={() =>
            act(
              () =>
                updateBowl(
                  s,
                  {
                    id: crypto.randomUUID(),
                    name: "New Sample Bowl",
                    category: "bowl",
                    round: "bowl",
                    teamAId: s.teams[0].id,
                    teamBId: s.teams[1].id,
                    status: "upcoming",
                    scheduledKickoff: new Date(
                      Math.max(
                        Date.parse(s.contest.bowlDeadline),
                        ...s.games
                          .filter((g) => g.category === "bowl")
                          .map((g) => Date.parse(g.scheduledKickoff)),
                      ) + 86400000,
                    ).toISOString(),
                  },
                  systemClock,
                ),
              "Bowl added",
            )
          }
        >
          Add sample bowl
        </button>
      </section>
      <section className="panel">
        <h2>Actual results</h2>
        <p>
          Results progress through an independent bracket. Correcting an
          advancing team clears dependent final results; re-enter those scores.
        </p>
        {s.games.map((g) => (
          <ResultEditor
            key={g.id + g.status + g.actualScoreA + g.actualScoreB}
            g={g}
            s={s}
            save={(a, b, final) =>
              act(
                () => setResult(s, g.id, a, b, final),
                final
                  ? "Final result saved; standings recalculated"
                  : "Result reopened",
              )
            }
          />
        ))}
      </section>
      <section className="panel">
        <h2>Participant entry review</h2>
        <div className="actions">
          <input
            aria-label="New participant name"
            placeholder="Display name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            onClick={() =>
              act(() => {
                if (!newName.trim()) throw Error("Display name required");
                const id = crypto.randomUUID(),
                  at = new Date().toISOString();
                return {
                  ...s,
                  participants: [
                    ...s.participants,
                    { id, displayName: newName.trim(), createdAt: at },
                  ],
                  entries: [
                    ...s.entries,
                    {
                      id: crypto.randomUUID(),
                      contestId: s.contest.id,
                      participantId: id,
                      createdAt: at,
                      updatedAt: at,
                      picks: [],
                    },
                  ],
                };
              }, "Local participant created")
            }
          >
            Add participant
          </button>
        </div>
        {s.entries.map((e) => (
          <details key={e.id}>
            <summary>
              {
                s.participants.find((p) => p.id === e.participantId)
                  ?.displayName
              }{" "}
              · Bowls: {e.bowlSubmission ? "submitted" : "draft"} · CFP:{" "}
              {e.cfpSubmission ? "submitted" : "draft"}
            </summary>
            <pre>
              {JSON.stringify(
                {
                  draft: e.picks,
                  bowls: e.bowlSubmission,
                  cfp: e.cfpSubmission,
                },
                null,
                2,
              )}
            </pre>
          </details>
        ))}
      </section>
    </>
  );
}
function BowlEditor({
  g,
  s,
  disabled,
  save,
}: {
  g: Game;
  s: State;
  disabled: boolean;
  save: (g: Game) => void;
}) {
  const [v, setV] = useState(g);
  return (
    <fieldset disabled={disabled} className="editor">
      <input
        aria-label={`${g.name} name`}
        value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })}
      />
      {(["teamAId", "teamBId"] as const).map((k) => (
        <select
          aria-label={`${g.name} ${k}`}
          key={k}
          value={v[k]}
          onChange={(e) => setV({ ...v, [k]: e.target.value })}
        >
          {s.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ))}
      <input
        aria-label={`${g.name} kickoff ISO`}
        value={v.scheduledKickoff}
        onChange={(e) => setV({ ...v, scheduledKickoff: e.target.value })}
      />
      <button onClick={() => save(v)}>Save game</button>
    </fieldset>
  );
}
function ResultEditor({
  g,
  s,
  save,
}: {
  g: Game;
  s: State;
  save: (a: number, b: number, final: boolean) => void;
}) {
  const [a, setA] = useState(g.actualScoreA?.toString() ?? ""),
    [b, setB] = useState(g.actualScoreB?.toString() ?? "");
  const teams = matchup(s, g, actualWinners(s)).map(
    (id) => s.teams.find((t) => t.id === id)?.name ?? "Awaiting winner",
  );
  return (
    <div className="result">
      <div>
        <strong>{g.name}</strong>
        <small>
          {teams.join(" vs. ")} · {g.status}
        </small>
      </div>
      <input
        aria-label={`${g.name} score A`}
        type="number"
        min="0"
        value={a}
        onChange={(e) => setA(e.target.value)}
      />
      <span>–</span>
      <input
        aria-label={`${g.name} score B`}
        type="number"
        min="0"
        value={b}
        onChange={(e) => setB(e.target.value)}
      />
      <button
        onClick={() =>
          save(a === "" ? NaN : Number(a), b === "" ? NaN : Number(b), true)
        }
      >
        Finalize / correct
      </button>
      {g.status === "final" && (
        <button onClick={() => save(0, 1, false)}>Reopen</button>
      )}
    </div>
  );
}
