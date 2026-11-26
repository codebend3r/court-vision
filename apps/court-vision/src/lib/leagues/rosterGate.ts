import { type LeagueSummary } from "@/lib/leagues/types";

// Whether a league can be read roster by roster: the Roster Advisor, the
// Waiver Wire and the dashboard's advice all need a Yahoo league (so every
// team's roster is known), scored by category, with the user's team picked.
// Each surface maps the blocked states to its own message; this is the one
// place the rule itself lives.
export type RosterGate =
  | { kind: "no_league" }
  | { kind: "not_imported" }
  | { kind: "points" }
  | { kind: "no_team"; leagueId: string }
  | { kind: "ready"; league: LeagueSummary; myTeamId: string };

// The states that block with a fixed message (no team has its own picker).
export type BlockedRosterGateKind = Exclude<RosterGate["kind"], "ready" | "no_team">;

type RosterGateProps = { league: LeagueSummary | null };

export const rosterGate = ({ league }: RosterGateProps): RosterGate => {
  if (league === null) return { kind: "no_league" };
  if (!league.isImported) return { kind: "not_imported" };
  if (league.scoringType === "h2h_points") return { kind: "points" };
  if (league.myTeamId === null) return { kind: "no_team", leagueId: league.id };
  return { kind: "ready", league, myTeamId: league.myTeamId };
};
