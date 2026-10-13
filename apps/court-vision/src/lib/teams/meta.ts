export type Conference = "East" | "West";
export type Division = "Atlantic" | "Central" | "Southeast" | "Northwest" | "Pacific" | "Southwest";

// The one table of NBA franchises: identity (abbreviation, name, the chip and
// chart colors) and league structure (the /team?is=<slug> nickname, the
// conference and division the /teams views group by).
export const NBA_TEAMS = [
  {
    abbreviation: "ATL",
    name: "Atlanta Hawks",
    slug: "hawks",
    conference: "East",
    division: "Southeast",
    primary: "#E03A3E",
    secondary: "#C1D32F",
  },
  {
    abbreviation: "BOS",
    name: "Boston Celtics",
    slug: "celtics",
    conference: "East",
    division: "Atlantic",
    primary: "#007A33",
    secondary: "#BA9653",
  },
  {
    abbreviation: "BKN",
    name: "Brooklyn Nets",
    slug: "nets",
    conference: "East",
    division: "Atlantic",
    primary: "#000000",
    secondary: "#FFFFFF",
  },
  {
    abbreviation: "CHA",
    name: "Charlotte Hornets",
    slug: "hornets",
    conference: "East",
    division: "Southeast",
    primary: "#1D1160",
    secondary: "#00788C",
  },
  {
    abbreviation: "CHI",
    name: "Chicago Bulls",
    slug: "bulls",
    conference: "East",
    division: "Central",
    primary: "#CE1141",
    secondary: "#000000",
  },
  {
    abbreviation: "CLE",
    name: "Cleveland Cavaliers",
    slug: "cavaliers",
    conference: "East",
    division: "Central",
    primary: "#860038",
    secondary: "#FDBB30",
  },
  {
    abbreviation: "DAL",
    name: "Dallas Mavericks",
    slug: "mavericks",
    conference: "West",
    division: "Southwest",
    primary: "#00538C",
    secondary: "#B8C4CA",
  },
  {
    abbreviation: "DEN",
    name: "Denver Nuggets",
    slug: "nuggets",
    conference: "West",
    division: "Northwest",
    primary: "#0E2240",
    secondary: "#FEC524",
  },
  {
    abbreviation: "DET",
    name: "Detroit Pistons",
    slug: "pistons",
    conference: "East",
    division: "Central",
    primary: "#C8102E",
    secondary: "#1D42BA",
  },
  {
    abbreviation: "GSW",
    name: "Golden State Warriors",
    slug: "warriors",
    conference: "West",
    division: "Pacific",
    primary: "#1D428A",
    secondary: "#FFC72C",
  },
  {
    abbreviation: "HOU",
    name: "Houston Rockets",
    slug: "rockets",
    conference: "West",
    division: "Southwest",
    primary: "#CE1141",
    secondary: "#000000",
  },
  {
    abbreviation: "IND",
    name: "Indiana Pacers",
    slug: "pacers",
    conference: "East",
    division: "Central",
    primary: "#002D62",
    secondary: "#FDBB30",
  },
  {
    abbreviation: "LAC",
    name: "LA Clippers",
    slug: "clippers",
    conference: "West",
    division: "Pacific",
    primary: "#C8102E",
    secondary: "#1D428A",
  },
  {
    abbreviation: "LAL",
    name: "Los Angeles Lakers",
    slug: "lakers",
    conference: "West",
    division: "Pacific",
    primary: "#552583",
    secondary: "#FDB927",
  },
  {
    abbreviation: "MEM",
    name: "Memphis Grizzlies",
    slug: "grizzlies",
    conference: "West",
    division: "Southwest",
    primary: "#5D76A9",
    secondary: "#12173F",
  },
  {
    abbreviation: "MIA",
    name: "Miami Heat",
    slug: "heat",
    conference: "East",
    division: "Southeast",
    primary: "#98002E",
    secondary: "#F9A01B",
  },
  {
    abbreviation: "MIL",
    name: "Milwaukee Bucks",
    slug: "bucks",
    conference: "East",
    division: "Central",
    primary: "#00471B",
    secondary: "#EEE1C6",
  },
  {
    abbreviation: "MIN",
    name: "Minnesota Timberwolves",
    slug: "timberwolves",
    conference: "West",
    division: "Northwest",
    primary: "#0C2340",
    secondary: "#78BE20",
  },
  {
    abbreviation: "NOP",
    name: "New Orleans Pelicans",
    slug: "pelicans",
    conference: "West",
    division: "Southwest",
    primary: "#0C2340",
    secondary: "#C8102E",
  },
  {
    abbreviation: "NYK",
    name: "New York Knicks",
    slug: "knicks",
    conference: "East",
    division: "Atlantic",
    primary: "#006BB6",
    secondary: "#F58426",
  },
  {
    abbreviation: "OKC",
    name: "Oklahoma City Thunder",
    slug: "thunder",
    conference: "West",
    division: "Northwest",
    primary: "#007AC1",
    secondary: "#EF3B24",
  },
  {
    abbreviation: "ORL",
    name: "Orlando Magic",
    slug: "magic",
    conference: "East",
    division: "Southeast",
    primary: "#0077C0",
    secondary: "#C4CED4",
  },
  {
    abbreviation: "PHI",
    name: "Philadelphia 76ers",
    slug: "76ers",
    conference: "East",
    division: "Atlantic",
    primary: "#006BB6",
    secondary: "#ED174C",
  },
  {
    abbreviation: "PHX",
    name: "Phoenix Suns",
    slug: "suns",
    conference: "West",
    division: "Pacific",
    primary: "#1D1160",
    secondary: "#E56020",
  },
  {
    abbreviation: "POR",
    name: "Portland Trail Blazers",
    slug: "trail-blazers",
    conference: "West",
    division: "Northwest",
    primary: "#E03A3E",
    secondary: "#000000",
  },
  {
    abbreviation: "SAC",
    name: "Sacramento Kings",
    slug: "kings",
    conference: "West",
    division: "Pacific",
    primary: "#5A2D81",
    secondary: "#63727A",
  },
  {
    abbreviation: "SAS",
    name: "San Antonio Spurs",
    slug: "spurs",
    conference: "West",
    division: "Southwest",
    primary: "#C4CED4",
    secondary: "#000000",
  },
  {
    abbreviation: "TOR",
    name: "Toronto Raptors",
    slug: "raptors",
    conference: "East",
    division: "Atlantic",
    primary: "#CE1141",
    secondary: "#000000",
  },
  {
    abbreviation: "UTA",
    name: "Utah Jazz",
    slug: "jazz",
    conference: "West",
    division: "Northwest",
    primary: "#6A2C91",
    secondary: "#6CACE4",
  },
  {
    abbreviation: "WAS",
    name: "Washington Wizards",
    slug: "wizards",
    conference: "East",
    division: "Southeast",
    primary: "#002B5C",
    secondary: "#E31837",
  },
] as const satisfies ReadonlyArray<{
  abbreviation: string;
  name: string;
  slug: string;
  conference: Conference;
  division: Division;
  primary: string;
  secondary: string;
}>;

export type NbaTeam = (typeof NBA_TEAMS)[number];

export type TeamAbbreviation = NbaTeam["abbreviation"];

const TEAM_BY_ABBREVIATION: ReadonlyMap<string, NbaTeam> = new Map(
  NBA_TEAMS.map((team) => [team.abbreviation, team]),
);

export type TeamColors = { name: string; primary: string; secondary: string };

// Single source of truth for team colors so every surface that wears them (the
// chip, the player avatar border, the standings lines) always matches.
export const teamColorsFor = ({ team }: { team: string | null }): TeamColors | null =>
  team === null ? null : (TEAM_BY_ABBREVIATION.get(team) ?? null);

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

// The team a /team?is=<slug> URL names, matched case-insensitively.
export const teamBySlug = ({ slug }: { slug: string }): NbaTeam | undefined =>
  NBA_TEAMS.find((team) => team.slug === slug.toLowerCase());
