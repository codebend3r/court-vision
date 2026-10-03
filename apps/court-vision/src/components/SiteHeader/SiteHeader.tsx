import Link from "next/link";

import { AccountMenu } from "@/components/AccountMenu/AccountMenu";
import { LeagueSwitcher } from "@/components/LeagueSwitcher/LeagueSwitcher";
import { LogoLockup } from "@/components/Logo/Logo";
import { ThemeSwatches } from "@/components/ThemeSwatches/ThemeSwatches";
import { getProfile } from "@/lib/auth/session";

import styles from "@/components/SiteHeader/SiteHeader.module.scss";

export async function SiteHeader() {
  const profile = await getProfile();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.home} aria-label="Court Vision">
        <LogoLockup />
      </Link>
      {/* Centre-left: the active league pill (renders nothing when the store
          holds no leagues, e.g. signed out). */}
      <div className={styles.league}>{!!profile && <LeagueSwitcher />}</div>
      <div className={styles.actions}>
        <ThemeSwatches />
        {profile ? (
          <AccountMenu username={profile.username} />
        ) : (
          <Link href="/login" className={styles.signIn}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
