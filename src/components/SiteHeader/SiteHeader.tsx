import Image from "next/image";
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
        {/* Decorative: the wordmark text beside it already names the link. */}
        {/* `unoptimized` skips the Netlify image CDN — the mark is a 6KB flat-art
            PNG served at a fixed size, so a transform saves nothing, and it keeps
            the logo from 404ing wherever /.netlify/images isn't served. */}
        <Image
          src="/court-vision-mark.png"
          alt=""
          width={32}
          height={32}
          className={styles.mark}
          priority
          unoptimized
        />
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
