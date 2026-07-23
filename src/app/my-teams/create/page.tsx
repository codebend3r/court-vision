import Link from "next/link";

import { TeamBuilder } from "@/components/TeamBuilder/TeamBuilder";
import { buildPlayerInsights } from "@/lib/fantasyTeams/insights";
import { fantasyPlayersFromPool } from "@/lib/fantasyTeams/players";
import { getFantasyPool } from "@/lib/valuation/loader";

import styles from "@/app/my-teams/create/page.module.scss";

export const dynamic = "force-dynamic";

export default async function CreateTeamPage() {
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
      <TeamBuilder players={players} insights={insights} />
    </main>
  );
}
