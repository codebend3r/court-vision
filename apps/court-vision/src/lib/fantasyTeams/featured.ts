import { type FantasyTeam } from "@/lib/fantasyTeams/types";

// The team the dashboard features: the most recently created one, since that
// is the roster a manager is most likely still filling. Null with no teams.
export const featuredTeam = ({ teams }: { teams: readonly FantasyTeam[] }): FantasyTeam | null =>
  teams.reduce<FantasyTeam | null>(
    (newest, team) => (newest === null || team.createdAt > newest.createdAt ? team : newest),
    null,
  );
