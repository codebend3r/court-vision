import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { getProfile } from "@/lib/auth/session";
import { getActiveLeague } from "@/lib/leagues/queries";
import { type LeagueSummary } from "@/lib/leagues/types";

import styles from "@/styles/leagueScopedPage.module.scss";

// The guard every /my-teams page opens with: a signed-out visitor is sent to
// log in (and back to the team list after), and a signed-in one gets the
// active league, or null when they have not made one yet.
export const loadMyTeamsLeague = async (): Promise<LeagueSummary | null> => {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/my-teams");
  return getActiveLeague();
};

// What a /my-teams page shows without a league: its own header, then the
// pointer to create one.
type NoLeaguePageProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function NoLeaguePage({ title, description, actions }: NoLeaguePageProps) {
  return (
    <main className={styles.page}>
      <PageHeader eyebrow="My league" title={title} description={description} actions={actions} />
      <p className={styles.scope}>
        No league yet — <Link href="/leagues/create">create a league</Link> to start building teams.
      </p>
    </main>
  );
}
