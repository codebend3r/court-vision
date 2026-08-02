import Link from "next/link";
import { redirect } from "next/navigation";

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
        <header className={styles.header}>
          <h1>Create team</h1>
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

  // The cached fantasy pool already carries everything the builder needs:
  // identity, position, and team for every active player this season.
  const lines = await getFantasyPool({ range: "all" });
  const players = fantasyPlayersFromPool({ lines });
  const insights = buildPlayerInsights({ lines });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Create team</h1>
        <Link href="/my-teams" className={styles.back}>
          ← My Teams
        </Link>
      </header>
      <TeamBuilder leagueId={league.id} players={players} insights={insights} />
    </main>
  );
}
