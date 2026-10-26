import { MyTeamsList } from "@/components/MyTeamsList/MyTeamsList";
import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { loadMyTeamsLeague, NoLeaguePage } from "@/app/my-teams/myTeamsGate";

import styles from "@/styles/leagueScopedPage.module.scss";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Your rosters in this league, slot by slot, with the eligibility rules already applied.";

type MyTeamsPageProps = {
  searchParams: Promise<{ open?: string | string[] }>;
};

export default async function MyTeamsPage({ searchParams }: MyTeamsPageProps) {
  // A finished Yahoo import links here with the user's team id, so that team's
  // roster opens on arrival.
  const { open } = await searchParams;
  const openTeamId = typeof open === "string" ? open : null;
  const league = await loadMyTeamsLeague();

  if (league === null) {
    return <NoLeaguePage title="Fantasy League" description={DESCRIPTION} />;
  }

  const teams = await getLeagueTeams({ leagueId: league.id });

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title="Fantasy League"
        description={DESCRIPTION}
        actions={!league.isImported && <PageAction href="/my-teams/create">New team</PageAction>}
      />
      <MyTeamsList
        teams={teams}
        leagueName={league.name}
        isImported={league.isImported}
        openTeamId={openTeamId}
      />
    </main>
  );
}
