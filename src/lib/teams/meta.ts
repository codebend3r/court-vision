import { NBA_TEAMS, type TeamAbbreviation } from "@/components/TeamChip/TeamChip";

export type Conference = "East" | "West";
export type Division = "Atlantic" | "Central" | "Southeast" | "Northwest" | "Pacific" | "Southwest";

export type TeamMeta = {
  abbr: TeamAbbreviation;
  name: string;
  slug: string; // nickname used by /team?is=<slug>
  conference: Conference;
  division: Division;
};

const TEAM_DETAILS: Record<
  TeamAbbreviation,
  { slug: string; conference: Conference; division: Division }
> = {
  ATL: { slug: "hawks", conference: "East", division: "Southeast" },
  BOS: { slug: "celtics", conference: "East", division: "Atlantic" },
  BKN: { slug: "nets", conference: "East", division: "Atlantic" },
  CHA: { slug: "hornets", conference: "East", division: "Southeast" },
  CHI: { slug: "bulls", conference: "East", division: "Central" },
  CLE: { slug: "cavaliers", conference: "East", division: "Central" },
  DAL: { slug: "mavericks", conference: "West", division: "Southwest" },
  DEN: { slug: "nuggets", conference: "West", division: "Northwest" },
  DET: { slug: "pistons", conference: "East", division: "Central" },
  GSW: { slug: "warriors", conference: "West", division: "Pacific" },
  HOU: { slug: "rockets", conference: "West", division: "Southwest" },
  IND: { slug: "pacers", conference: "East", division: "Central" },
  LAC: { slug: "clippers", conference: "West", division: "Pacific" },
  LAL: { slug: "lakers", conference: "West", division: "Pacific" },
  MEM: { slug: "grizzlies", conference: "West", division: "Southwest" },
  MIA: { slug: "heat", conference: "East", division: "Southeast" },
  MIL: { slug: "bucks", conference: "East", division: "Central" },
  MIN: { slug: "timberwolves", conference: "West", division: "Northwest" },
  NOP: { slug: "pelicans", conference: "West", division: "Southwest" },
  NYK: { slug: "knicks", conference: "East", division: "Atlantic" },
  OKC: { slug: "thunder", conference: "West", division: "Northwest" },
  ORL: { slug: "magic", conference: "East", division: "Southeast" },
  PHI: { slug: "76ers", conference: "East", division: "Atlantic" },
  PHX: { slug: "suns", conference: "West", division: "Pacific" },
  POR: { slug: "trail-blazers", conference: "West", division: "Northwest" },
  SAC: { slug: "kings", conference: "West", division: "Pacific" },
  SAS: { slug: "spurs", conference: "West", division: "Southwest" },
  TOR: { slug: "raptors", conference: "East", division: "Atlantic" },
  UTA: { slug: "jazz", conference: "West", division: "Northwest" },
  WAS: { slug: "wizards", conference: "East", division: "Southeast" },
};

// Names and colors come from TeamChip's NBA_TEAMS so team identity has one
// source of truth; this module adds the league structure on top.
export const TEAM_META: readonly TeamMeta[] = NBA_TEAMS.map((team) => ({
  abbr: team.abbreviation,
  name: team.name,
  ...TEAM_DETAILS[team.abbreviation],
}));

export const CONFERENCES: readonly Conference[] = ["East", "West"];

// East divisions first, then West — the order the /teams division view renders.
export const DIVISIONS: readonly Division[] = [
  "Atlantic",
  "Central",
  "Southeast",
  "Northwest",
  "Pacific",
  "Southwest",
];

export const CONFERENCE_BY_DIVISION: Record<Division, Conference> = {
  Atlantic: "East",
  Central: "East",
  Southeast: "East",
  Northwest: "West",
  Pacific: "West",
  Southwest: "West",
};

export const teamBySlug = (slug: string): TeamMeta | undefined =>
  TEAM_META.find((team) => team.slug === slug.toLowerCase());

export const teamByAbbr = (abbr: string): TeamMeta | undefined =>
  TEAM_META.find((team) => team.abbr === abbr);
