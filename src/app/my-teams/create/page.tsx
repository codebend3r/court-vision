import Link from "next/link";
import { redirect } from "next/navigation";

import { PageAction, PageHeader } from "@/components/PageHeader/PageHeader";
import { TeamBuilder } from "@/components/TeamBuilder/TeamBuilder";
import { getProfile } from "@/lib/auth/session";
import { buildPlayerInsights } from "@/lib/fantasyTeams/insights";
import { fantasyPlayersFromPool } from "@/lib/fantasyTeams/players";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getFantasyPool } from "@/lib/valuation/loader";

import styles from "@/app/my-teams/create/page.module.scss";

export const dynamic = "force-dynamic";

export default async function CreateTeamPage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/my-teams");

  const league = await getActiveLeague();

  if (league === null) {
    return (
      <main className={styles.page}>
        <PageHeader
          eyebrow="My league"
          title="Create team"
          actions={<PageAction href="/my-teams">My teams</PageAction>}
        />
        <p className={styles.scope}>
          No league yet — <Link href="/leagues/create">create a league</Link> to start building
          teams.
        </p>
      </main>
    );
  }

  // The cached fantasy pool already carries everything the builder needs:
  // identity, position, and team for every active player this season.
  const lines = await getFantasyPool({ range: "all" });
  const players = fantasyPlayersFromPool({ lines });
  const insights = buildPlayerInsights({ lines });

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title="Create team"
        description="Fill every slot the league defines — eligibility rules apply as you pick."
        actions={<PageAction href="/my-teams">My teams</PageAction>}
      />
      <TeamBuilder leagueId={league.id} players={players} insights={insights} />
    </main>
  );
}
