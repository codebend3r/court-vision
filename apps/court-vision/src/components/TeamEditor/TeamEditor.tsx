import { TeamBuilder } from "@/components/TeamBuilder/TeamBuilder";
import { type PlayerInsight } from "@/lib/fantasyTeams/insights";
import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

export type TeamEditorProps = {
  leagueId: string;
  team: FantasyTeam;
  players: FantasyTeamPlayer[];
  insights?: PlayerInsight[];
};

// The server page already resolved /my-teams/<slug> to a team row (or 404'd),
// so this is a thin pass-through to the same builder used for creation.
export function TeamEditor({ leagueId, team, players, insights }: TeamEditorProps) {
  return <TeamBuilder leagueId={leagueId} players={players} team={team} insights={insights} />;
}
