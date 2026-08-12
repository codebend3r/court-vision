import Link from "next/link";
import { redirect } from "next/navigation";

import { MyTeamsList } from "@/components/MyTeamsList/MyTeamsList";
import { PageAction, PageHeader } from "@/components/PageHeader/PageHeader";
import { getProfile } from "@/lib/auth/session";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";

import styles from "@/app/my-teams/page.module.scss";

export const dynamic = "force-dynamic";

export default async function MyTeamsPage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/my-teams");

  const league = await getActiveLeague();

  if (league === null) {
    return (
      <main className={styles.page}>
        <PageHeader
          eyebrow="My league"
          title="My teams"
          description="Your rosters in this league, slot by slot, with the eligibility rules already applied."
        />
        <p className={styles.scope}>
          No league yet — <Link href="/leagues/create">create a league</Link> to start building
          teams.
        </p>
      </main>
    );
  }

  const teams = await getLeagueTeams({ leagueId: league.id });

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title="My teams"
        description="Your rosters in this league, slot by slot, with the eligibility rules already applied."
        actions={<PageAction href="/my-teams/create">New team</PageAction>}
      />
      <MyTeamsList teams={teams} leagueName={league.name} />
    </main>
  );
}
