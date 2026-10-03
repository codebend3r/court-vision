import { redirect } from "next/navigation";

import { LeagueForm } from "@/components/LeagueForm/LeagueForm";
import { PageAction, PageHeader } from "@/components/PageHeader/PageHeader";
import { getProfile } from "@/lib/auth/session";

import styles from "@/app/leagues/leagues.module.scss";

export const dynamic = "force-dynamic";

export default async function CreateLeaguePage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/leagues");

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title="Create league"
        actions={<PageAction href="/leagues">Leagues</PageAction>}
      />
      <LeagueForm league={null} />
    </main>
  );
}
