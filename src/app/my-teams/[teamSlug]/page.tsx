import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageAction, PageHeader } from "@/components/PageHeader/PageHeader";
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
        <PageHeader
          eyebrow="My league"
          title="Edit team"
          actions={<PageAction href="/my-teams">My teams</PageAction>}
        />
        <p className={styles.scope}>
          No league yet — <Link href="/leagues/create">create a league</Link> to start building
          teams.
        </p>
      </main>
    );
  }

  // The pool is league-independent, so it loads alongside the team lookup
  // rather than after it.
  const [team, lines] = await Promise.all([
    getLeagueTeamBySlug({ leagueId: league.id, slug: teamSlug }),
    getFantasyPool({ range: "all" }),
  ]);
  if (team === null) notFound();

  const players = fantasyPlayersFromPool({ lines });
  const insights = buildPlayerInsights({ lines });

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title={team.name}
        actions={<PageAction href="/my-teams">My teams</PageAction>}
      />
      <TeamEditor leagueId={league.id} team={team} players={players} insights={insights} />
    </main>
  );
}
