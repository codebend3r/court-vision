import { type FantasyStatLine } from "@/lib/valuation/types";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

// The builder's search pool: identity fields from the cached fantasy stat
// lines, plus every active-roster player who has no line yet (rookies, new
// signings, anyone still to play), so they can be found and drafted too.
// Alphabetized for stable results.
type FantasyPlayersFromPoolProps = {
  lines: readonly FantasyStatLine[];
  activePlayers?: readonly FantasyTeamPlayer[];
};

export const fantasyPlayersFromPool = ({
  lines,
  activePlayers = [],
}: FantasyPlayersFromPoolProps): FantasyTeamPlayer[] => {
  const fromLines = lines.map((line) => ({
    playerId: line.playerId,
    firstName: line.firstName,
    lastName: line.lastName,
    fullName: line.fullName,
    teamAbbr: line.teamAbbr,
    position: line.position,
    nbaPersonId: line.nbaPersonId,
  }));
  const withLines = new Set(fromLines.map((player) => player.playerId));
  const withoutLines = activePlayers.filter((player) => !withLines.has(player.playerId));
  return [...fromLines, ...withoutLines].sort(
    (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
  );
};
