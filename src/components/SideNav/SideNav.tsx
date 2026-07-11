"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "@/components/SideNav/SideNav.module.scss";

const NAV_ENTRIES = [
  { href: "/players", label: "Players" },
  { href: "/design", label: "Design" },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Site">
      <ul className={styles.list}>
        {NAV_ENTRIES.map((entry) => {
          const isActive = pathname === entry.href;
          return (
            <li key={entry.href} className={styles.item}>
              <Link
                href={entry.href}
                className={isActive ? `${styles.link} ${styles.active}` : styles.link}
                aria-current={isActive ? "page" : undefined}
              >
                {entry.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
