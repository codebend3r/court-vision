import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";

import mark from "@public/court-vision-mark.jpg";

import styles from "@/components/SiteHeader/SiteHeader.module.scss";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        <Image src={mark} alt="" width={32} height={32} className={styles.mark} priority />
        Court Vision
      </Link>
      <ThemeToggle />
    </header>
  );
}
