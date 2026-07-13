import Link from "next/link";

import { AccountMenu } from "@/components/AccountMenu/AccountMenu";
import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
import { getProfile } from "@/lib/auth/session";

import styles from "@/components/SiteHeader/SiteHeader.module.scss";

export async function SiteHeader() {
  const profile = await getProfile();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        Court Vision
      </Link>
      <div className={styles.actions}>
        <ThemeToggle />
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
