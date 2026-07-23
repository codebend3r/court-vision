import styles from "@/components/TeamChip/TeamChip.module.scss";

export const NBA_TEAMS = [
  { abbreviation: "ATL", name: "Atlanta Hawks", primary: "#E03A3E", secondary: "#C1D32F" },
  { abbreviation: "BOS", name: "Boston Celtics", primary: "#007A33", secondary: "#BA9653" },
  { abbreviation: "BKN", name: "Brooklyn Nets", primary: "#000000", secondary: "#FFFFFF" },
  { abbreviation: "CHA", name: "Charlotte Hornets", primary: "#1D1160", secondary: "#00788C" },
  { abbreviation: "CHI", name: "Chicago Bulls", primary: "#CE1141", secondary: "#000000" },
  { abbreviation: "CLE", name: "Cleveland Cavaliers", primary: "#860038", secondary: "#FDBB30" },
  { abbreviation: "DAL", name: "Dallas Mavericks", primary: "#00538C", secondary: "#B8C4CA" },
  { abbreviation: "DEN", name: "Denver Nuggets", primary: "#0E2240", secondary: "#FEC524" },
  { abbreviation: "DET", name: "Detroit Pistons", primary: "#C8102E", secondary: "#1D42BA" },
  { abbreviation: "GSW", name: "Golden State Warriors", primary: "#1D428A", secondary: "#FFC72C" },
  { abbreviation: "HOU", name: "Houston Rockets", primary: "#CE1141", secondary: "#000000" },
  { abbreviation: "IND", name: "Indiana Pacers", primary: "#002D62", secondary: "#FDBB30" },
  { abbreviation: "LAC", name: "LA Clippers", primary: "#C8102E", secondary: "#1D428A" },
  { abbreviation: "LAL", name: "Los Angeles Lakers", primary: "#552583", secondary: "#FDB927" },
  { abbreviation: "MEM", name: "Memphis Grizzlies", primary: "#5D76A9", secondary: "#12173F" },
  { abbreviation: "MIA", name: "Miami Heat", primary: "#98002E", secondary: "#F9A01B" },
  { abbreviation: "MIL", name: "Milwaukee Bucks", primary: "#00471B", secondary: "#EEE1C6" },
  { abbreviation: "MIN", name: "Minnesota Timberwolves", primary: "#0C2340", secondary: "#78BE20" },
  { abbreviation: "NOP", name: "New Orleans Pelicans", primary: "#0C2340", secondary: "#C8102E" },
  { abbreviation: "NYK", name: "New York Knicks", primary: "#006BB6", secondary: "#F58426" },
  { abbreviation: "OKC", name: "Oklahoma City Thunder", primary: "#007AC1", secondary: "#EF3B24" },
  { abbreviation: "ORL", name: "Orlando Magic", primary: "#0077C0", secondary: "#C4CED4" },
  { abbreviation: "PHI", name: "Philadelphia 76ers", primary: "#006BB6", secondary: "#ED174C" },
  { abbreviation: "PHX", name: "Phoenix Suns", primary: "#1D1160", secondary: "#E56020" },
  { abbreviation: "POR", name: "Portland Trail Blazers", primary: "#E03A3E", secondary: "#000000" },
  { abbreviation: "SAC", name: "Sacramento Kings", primary: "#5A2D81", secondary: "#63727A" },
  { abbreviation: "SAS", name: "San Antonio Spurs", primary: "#C4CED4", secondary: "#000000" },
  { abbreviation: "TOR", name: "Toronto Raptors", primary: "#CE1141", secondary: "#000000" },
  { abbreviation: "UTA", name: "Utah Jazz", primary: "#6A2C91", secondary: "#6CACE4" },
  { abbreviation: "WAS", name: "Washington Wizards", primary: "#002B5C", secondary: "#E31837" },
] as const;

export type TeamAbbreviation = (typeof NBA_TEAMS)[number]["abbreviation"];

export type TeamChipSize = "sm" | "md";

type NbaTeam = (typeof NBA_TEAMS)[number];

const TEAM_BY_ABBREVIATION: Map<string, NbaTeam> = new Map(
  NBA_TEAMS.map((team) => [team.abbreviation, team]),
);

export type TeamColors = { name: string; primary: string; secondary: string };

// Single source of truth for team colors so other components (e.g. the player
// avatar border) always match the chip.
export const teamColorsFor = ({ team }: { team: string | null }): TeamColors | null =>
  team === null ? null : (TEAM_BY_ABBREVIATION.get(team) ?? null);

export function TeamChip({ team, size = "md" }: { team: string; size?: TeamChipSize }) {
  const details = TEAM_BY_ABBREVIATION.get(team);
  const className = size === "sm" ? `${styles.chip} ${styles.sm}` : styles.chip;

  if (!details) {
    return <span className={className}>{team}</span>;
  }

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the label expands the visible team abbreviation.
    <span
      className={className}
      title={details.name}
      aria-label={details.name}
      style={{ backgroundColor: details.primary, color: details.secondary }}
    >
      {details.abbreviation}
    </span>
  );
}
