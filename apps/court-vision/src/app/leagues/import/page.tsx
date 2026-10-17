import { redirect } from "next/navigation";

import { YahooImportForm } from "@/components/YahooImportForm/YahooImportForm";
import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { getProfile } from "@/lib/auth/session";

import styles from "@/app/leagues/leagues.module.scss";

export const dynamic = "force-dynamic";

export default async function ImportLeaguePage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/leagues/import");

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title="Import from Yahoo"
        description="Bring your Yahoo Fantasy Basketball league into Court Vision: every team, logo and roster."
        actions={<PageAction href="/leagues">Leagues</PageAction>}
      />
      <YahooImportForm />
    </main>
  );
}
