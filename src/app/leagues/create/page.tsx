import Link from "next/link";
import { redirect } from "next/navigation";

import { LeagueForm } from "@/components/LeagueForm/LeagueForm";
import { getProfile } from "@/lib/auth/session";

import styles from "@/app/leagues/leagues.module.scss";

export const dynamic = "force-dynamic";

export default async function CreateLeaguePage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/leagues");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Create league</h1>
        <Link href="/leagues" className={styles.back}>
          ← Leagues
        </Link>
      </header>
      <LeagueForm league={null} />
    </main>
  );
}
