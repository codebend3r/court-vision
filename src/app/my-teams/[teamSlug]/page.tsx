import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TeamEditor } from "@/components/TeamEditor/TeamEditor";
import { getProfile } from "@/lib/auth/session";
import { buildPlayerInsights } from "@/lib/fantasyTeams/insights";
import { fantasyPlayersFromPool } from "@/lib/fantasyTeams/players";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueTeamBySlug } from "@/lib/leagues/teamQueries";
import { getFantasyPool } from "@/lib/valuation/loader";

import styles from "@/app/my-teams/[teamSlug]/page.module.scss";

export const dynamic = "force-dynamic";

export default async function EditTeamPage({ params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/my-teams");

  const league = await getActiveLeague();

  if (league === null) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>Edit team</h1>
          <Link href="/my-teams" className={styles.back}>
            ← My Teams
          </Link>
        </header>
        <p className={styles.scope}>
          No league yet — <Link href="/leagues/create">create a league</Link> to start building
          teams.
        </p>
      </main>
    );
  }

  const team = await getLeagueTeamBySlug({ leagueId: league.id, slug: teamSlug });
  if (team === null) notFound();

  const lines = await getFantasyPool({ range: "all" });
  const players = fantasyPlayersFromPool({ lines });
  const insights = buildPlayerInsights({ lines });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{team.name}</h1>
        <Link href="/my-teams" className={styles.back}>
          ← My Teams
        </Link>
      </header>
      <TeamEditor leagueId={league.id} team={team} players={players} insights={insights} />
    </main>
  );
}
