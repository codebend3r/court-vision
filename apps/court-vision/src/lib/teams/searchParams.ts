import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

export type TeamsView = "division" | "conference" | "league";
export const TEAMS_VIEWS: readonly TeamsView[] = ["division", "conference", "league"];

// /teams — grouping selector.
export const teamsParsers = {
  view: parseAsStringLiteral(TEAMS_VIEWS).withDefault("division"),
};

export const loadTeamsSearchParams = createLoader(teamsParsers);

// /team?is=<slug> — the team identifier ("raptors", "trail-blazers", …).
export const teamParsers = {
  is: parseAsString.withDefault(""),
};

export const loadTeamSearchParams = createLoader(teamParsers);
