import Link from "next/link";
import styles from "@/app/my-teams/[teamSlug]/page.module.scss";
import { TeamEditor } from "@/components/TeamEditor/TeamEditor";
import { fantasyPlayersFromPool } from "@/lib/fantasyTeams/players";
import { teamSlugToName } from "@/lib/fantasyTeams/slug";
import { getFantasyPool } from "@/lib/valuation/loader";

export const dynamic = "force-dynamic";

export default async function EditTeamPage({ params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const lines = await getFantasyPool({ range: "all" });
  const players = fantasyPlayersFromPool({ lines });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{teamSlugToName(teamSlug)}</h1>
        <Link href="/my-teams" className={styles.back}>
          ← My Teams
        </Link>
      </header>
      <TeamEditor slug={teamSlug} players={players} />
    </main>
  );
}
