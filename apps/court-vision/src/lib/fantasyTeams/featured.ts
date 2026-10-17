import { type FantasyTeam } from "@/lib/fantasyTeams/types";

// The team the dashboard features. In an imported league that's the team the
// user manages, or nothing: every other team is a league-mate's, however new.
// In a hand-built league it's the most recently created one, since that is
// the roster a manager is most likely still filling. Null with no teams.
export const featuredTeam = ({ teams }: { teams: readonly FantasyTeam[] }): FantasyTeam | null => {
  if (teams.some((team) => team.isImported)) return teams.find((team) => team.isMine) ?? null;
  return teams.reduce<FantasyTeam | null>(
    (newest, team) => (newest === null || team.createdAt > newest.createdAt ? team : newest),
    null,
  );
};
