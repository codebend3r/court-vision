import { buildPlayerInsights, DEFAULT_VALUATION_CONFIG } from "@vision/sport-basketball/engine";
import { notFound, redirect } from "next/navigation";

import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { TeamBuilder } from "@/components/TeamBuilder/TeamBuilder";
import { getActiveRosterPlayers } from "@/lib/fantasyTeams/loader";
import { fantasyPlayersFromPool } from "@/lib/fantasyTeams/players";
import { getLeagueTeamBySlug } from "@/lib/leagues/teamQueries";
import { getFantasyPool } from "@/lib/valuation/loader";
import { loadMyTeamsLeague, NoLeaguePage } from "@/app/my-teams/myTeamsGate";

import styles from "@/styles/leagueScopedPage.module.scss";

export const dynamic = "force-dynamic";

export default async function EditTeamPage({ params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const league = await loadMyTeamsLeague();

  if (league === null) {
    return (
      <NoLeaguePage
        title="Edit team"
        actions={<PageAction href="/my-teams">My teams</PageAction>}
      />
    );
  }

  // An imported league's teams are Yahoo's, so they are read-only: the
  // My teams list shows them instead of the builder.
  if (league.isImported) redirect("/my-teams");

  // The pool is league-independent, so it loads alongside the team lookup
  // rather than after it. The active roster adds players yet to play.
  const [team, lines, activePlayers] = await Promise.all([
    getLeagueTeamBySlug({ leagueId: league.id, slug: teamSlug }),
    getFantasyPool({ range: "all" }),
    getActiveRosterPlayers(),
  ]);
  if (team === null) notFound();
  if (team.isImported) redirect("/my-teams");

  const players = fantasyPlayersFromPool({ lines, activePlayers });
  const insights = buildPlayerInsights({ lines, config: DEFAULT_VALUATION_CONFIG });

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title={team.name}
        actions={<PageAction href="/my-teams">My teams</PageAction>}
      />
      <TeamBuilder leagueId={league.id} team={team} players={players} insights={insights} />
    </main>
  );
}
