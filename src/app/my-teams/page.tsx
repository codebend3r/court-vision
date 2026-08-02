import Link from "next/link";
import { redirect } from "next/navigation";

import { MyTeamsList } from "@/components/MyTeamsList/MyTeamsList";
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
        <header className={styles.header}>
          <h1>My Teams</h1>
        </header>
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
      <header className={styles.header}>
        <h1>My Teams</h1>
        <Link href="/my-teams/create" className={styles.create}>
          Create team
        </Link>
      </header>
      <MyTeamsList teams={teams} leagueName={league.name} />
    </main>
  );
}
