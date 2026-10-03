import { notFound, redirect } from "next/navigation";

import { LeagueForm } from "@/components/LeagueForm/LeagueForm";
import { PageAction, PageHeader } from "@/components/PageHeader/PageHeader";
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
      <PageHeader
        eyebrow="My league"
        title={league.name}
        actions={<PageAction href="/leagues">Leagues</PageAction>}
      />
      <LeagueForm league={league} />
    </main>
  );
}
