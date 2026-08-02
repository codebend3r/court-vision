import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LeagueForm } from "@/components/LeagueForm/LeagueForm";
import { getProfile } from "@/lib/auth/session";
import { getLeagues } from "@/lib/leagues/queries";

import styles from "@/app/leagues/leagues.module.scss";

export const dynamic = "force-dynamic";

export default async function EditLeaguePage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/leagues");

  const leagues = await getLeagues();
  const league = leagues.find((entry) => entry.slug === leagueSlug) ?? null;
  if (league === null) notFound();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{league.name}</h1>
        <Link href="/leagues" className={styles.back}>
          ← Leagues
        </Link>
      </header>
      <LeagueForm league={league} />
    </main>
  );
}
