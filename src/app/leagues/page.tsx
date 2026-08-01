import { redirect } from "next/navigation";

import { LeagueList } from "@/components/LeagueList/LeagueList";
import { getProfile } from "@/lib/auth/session";
import { getLeagues } from "@/lib/leagues/queries";

import styles from "@/app/leagues/page.module.scss";

export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/leagues");
  const leagues = await getLeagues();
  const activeLeagueId =
    leagues.find((league) => league.id === profile.activeLeagueId)?.id ?? leagues[0]?.id ?? null;
  return (
    <main className={styles.page}>
      <h1>Leagues</h1>
      <LeagueList leagues={leagues} activeLeagueId={activeLeagueId} />
    </main>
  );
}
