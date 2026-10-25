import { buildPlayerInsights, DEFAULT_VALUATION_CONFIG } from "@vision/sport-basketball/engine";
import { redirect } from "next/navigation";

import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { TeamBuilder } from "@/components/TeamBuilder/TeamBuilder";
import { getActiveRosterPlayers } from "@/lib/fantasyTeams/loader";
import { fantasyPlayersFromPool } from "@/lib/fantasyTeams/players";
import { getFantasyPool } from "@/lib/valuation/loader";
import { loadMyTeamsLeague, NoLeaguePage } from "@/app/my-teams/myTeamsGate";

import styles from "@/styles/leagueScopedPage.module.scss";

export const dynamic = "force-dynamic";

export default async function CreateTeamPage() {
  const league = await loadMyTeamsLeague();

  if (league === null) {
    return (
      <NoLeaguePage
        title="Create team"
        actions={<PageAction href="/my-teams">Fantasy League</PageAction>}
      />
    );
  }

  // An imported league's teams are Yahoo's: there is nothing to build here.
  if (league.isImported) redirect("/my-teams");

  // The cached fantasy pool carries identity, position, and team for every
  // player with a line this season; the active roster adds those who have yet
  // to play, so rookies can be drafted before opening night.
  const [lines, activePlayers] = await Promise.all([
    getFantasyPool({ range: "all" }),
    getActiveRosterPlayers(),
  ]);
  const players = fantasyPlayersFromPool({ lines, activePlayers });
  const insights = buildPlayerInsights({ lines, config: DEFAULT_VALUATION_CONFIG });

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title="Create team"
        description="Fill every slot the league defines — eligibility rules apply as you pick."
        actions={<PageAction href="/my-teams">Fantasy League</PageAction>}
      />
      <TeamBuilder leagueId={league.id} team={null} players={players} insights={insights} />
    </main>
  );
}
