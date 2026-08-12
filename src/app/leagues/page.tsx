import { redirect } from "next/navigation";

import { LeagueList } from "@/components/LeagueList/LeagueList";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { getProfile } from "@/lib/auth/session";
import { fallbackActiveLeagueId, getLeagues } from "@/lib/leagues/queries";

import styles from "@/app/leagues/page.module.scss";

export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/leagues");
  const leagues = await getLeagues();
  // Matches resolveActiveLeague's DB-side fallback (updatedAt desc), not
  // getLeagues' display order (createdAt asc) — see fallbackActiveLeagueId.
  const activeLeagueId = fallbackActiveLeagueId({
    leagues,
    activeLeagueId: profile.activeLeagueId,
  });
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title="Leagues"
        description="League settings drive the valuation engine — team count and roster size set the replacement level."
      />
      <LeagueList leagues={leagues} activeLeagueId={activeLeagueId} />
    </main>
  );
}
