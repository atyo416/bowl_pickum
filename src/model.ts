export type Round =
  | "bowl"
  | "cfpFirstRound"
  | "cfpQuarterfinal"
  | "cfpSemifinal"
  | "cfpChampionship";
export const rounds: Round[] = [
  "bowl",
  "cfpFirstRound",
  "cfpQuarterfinal",
  "cfpSemifinal",
  "cfpChampionship",
];
export const labels: Record<Round, string> = {
  bowl: "Bowl games",
  cfpFirstRound: "First round",
  cfpQuarterfinal: "Quarterfinals",
  cfpSemifinal: "Semifinals",
  cfpChampionship: "Championship",
};
export const defaultPointsByRound: Record<Round, number> = {
  bowl: 1,
  cfpFirstRound: 1,
  cfpQuarterfinal: 2,
  cfpSemifinal: 3,
  cfpChampionship: 4,
};
export interface Contest {
  id: string;
  name: string;
  season: string;
  timezone: string;
  bowlDeadline: string;
  cfpDeadline: string;
  pointsByRound: Record<Round, number>;
  status: "setup" | "started";
}
export interface Team {
  id: string;
  name: string;
  seed?: number;
}
export interface Participant {
  id: string;
  displayName: string;
  createdAt: string;
}
export type Source = { teamId: string } | { winnerOf: string };
export interface BracketSlot {
  gameId: string;
  round: Round;
  sourceA: Source;
  sourceB: Source;
  pointCategory: Round;
}
export interface Game {
  id: string;
  name: string;
  category: "bowl" | "cfp";
  round: Round;
  scheduledKickoff: string;
  teamAId?: string;
  teamBId?: string;
  actualScoreA?: number;
  actualScoreB?: number;
  status: "upcoming" | "final";
}
export interface Pick {
  entryId: string;
  gameId: string;
  predictedWinnerTeamId: string;
}
export interface Submission {
  picks: Pick[];
  championshipTotalPrediction?: number;
  submittedAt: string;
}
export interface Entry {
  id: string;
  contestId: string;
  participantId: string;
  createdAt: string;
  updatedAt: string;
  bowlSubmittedAt?: string;
  cfpSubmittedAt?: string;
  championshipTotalPrediction?: number;
  picks: Pick[];
  bowlSubmission?: Submission;
  cfpSubmission?: Submission;
}
export interface State {
  version: 1;
  contest: Contest;
  teams: Team[];
  participants: Participant[];
  games: Game[];
  slots: BracketSlot[];
  entries: Entry[];
  simulatedNow?: string;
}
export interface Clock {
  now(): Date;
}
export const systemClock: Clock = { now: () => new Date() };
