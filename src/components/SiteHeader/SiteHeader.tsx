import Link from "next/link";

import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";

import styles from "./SiteHeader.module.scss";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        Court Vision
      </Link>
      <ThemeToggle />
    </header>
  );
}
