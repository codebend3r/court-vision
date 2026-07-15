import Link from "next/link";

import { ComingSoonPanel } from "@/components/ComingSoonPanel/ComingSoonPanel";
import { getProfile } from "@/lib/auth/session";

import styles from "@/app/page.module.scss";

export default async function Home() {
  const profile = await getProfile();
  const isSignedIn = !!profile;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Court Vision</h1>
      <p className={styles.subtitle}>
        Your fantasy command center &mdash; here&apos;s what&apos;s coming.
      </p>
      <div className={styles.grid}>
        {isSignedIn ? (
          <ComingSoonPanel title="Your Team" description="You haven't built a fantasy team yet." />
        ) : (
          <section className={styles.signInCard} aria-labelledby="home-team-title">
            <h2 id="home-team-title" className={styles.cardTitle}>
              Your Team
            </h2>
            <p className={styles.cardBody}>
              <Link href="/login">Sign in</Link> to start building your team.
            </p>
          </section>
        )}
        {isSignedIn ? (
          <ComingSoonPanel
            title="Watched Players"
            description="You aren't watching any players yet."
          />
        ) : (
          <section className={styles.signInCard} aria-labelledby="home-watchlist-title">
            <h2 id="home-watchlist-title" className={styles.cardTitle}>
              Watched Players
            </h2>
            <p className={styles.cardBody}>
              <Link href="/login">Sign in</Link> to watch players.
            </p>
          </section>
        )}
        <ComingSoonPanel
          title="Stat Trends to Watch"
          description="Short on rebounds? We'll surface players trending up in the stats your team needs."
        />
      </div>
    </main>
  );
}
