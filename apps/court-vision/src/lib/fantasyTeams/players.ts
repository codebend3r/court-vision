import { type FantasyStatLine } from "@/lib/valuation/types";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

// The builder's search pool: identity fields from the cached fantasy stat
// lines, alphabetized for stable results.
export const fantasyPlayersFromPool = ({
  lines,
}: {
  lines: readonly FantasyStatLine[];
}): FantasyTeamPlayer[] =>
  lines
    .map((line) => ({
      playerId: line.playerId,
      firstName: line.firstName,
      lastName: line.lastName,
      fullName: line.fullName,
      teamAbbr: line.teamAbbr,
      position: line.position,
      nbaPersonId: line.nbaPersonId,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
