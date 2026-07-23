"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import styles from "@/components/SideNav/SideNav.module.scss";
import { useSideNavStore } from "@/components/SideNav/sideNavStore";

const NAV_ENTRIES = [
  { href: "/players", label: "Players", shortLabel: "P" },
  { href: "/teams", label: "Teams", shortLabel: "T" },
  { href: "/my-teams", label: "My Teams", shortLabel: "M" },
  { href: "/design", label: "Design", shortLabel: "D" },
];

export function SideNav() {
  const pathname = usePathname();
  const isCollapsed = useSideNavStore((state) => state.isCollapsed);
  const toggleCollapsed = useSideNavStore((state) => state.toggleCollapsed);

  useEffect(() => {
    void useSideNavStore.persist.rehydrate();
  }, []);

  return (
    <nav className={styles.nav} aria-label="Site" data-collapsed={isCollapsed ? "true" : "false"}>
      <ul className={styles.list}>
        {NAV_ENTRIES.map((entry) => {
          // /team (the detail page) belongs to Teams; /my-teams/create to My Teams.
          const isActive =
            pathname === entry.href ||
            (entry.href === "/teams" && pathname === "/team") ||
            (entry.href === "/my-teams" && pathname.startsWith("/my-teams/"));
          return (
            <li key={entry.href} className={styles.item}>
              <Link
                href={entry.href}
                className={isActive ? `${styles.link} ${styles.active}` : styles.link}
                aria-current={isActive ? "page" : undefined}
                aria-label={entry.label}
                title={isCollapsed ? entry.label : undefined}
              >
                <span className={styles.shortLabel} aria-hidden="true">
                  {entry.shortLabel}
                </span>
                <span className={styles.label} aria-hidden="true">
                  {entry.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={styles.collapseButton}
        onClick={toggleCollapsed}
        aria-label={isCollapsed ? "Expand side menu" : "Collapse side menu"}
        aria-expanded={!isCollapsed}
      >
        <span aria-hidden="true">{isCollapsed ? "›" : "‹"}</span>
      </button>
    </nav>
  );
}
