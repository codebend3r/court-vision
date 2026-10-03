"use client";

import Link, { useLinkStatus } from "next/link";

import styles from "@/components/StatViewTabs/StatViewTabs.module.scss";

export type StatViewTabEntry = {
  key: string;
  href: string;
  label: string;
  isActive: boolean;
};

// Reflects the in-flight navigation of the enclosing <Link>. Rendered inside a
// Link, `useLinkStatus` flips to pending the moment the tab is clicked and
// clears once the new stats render, so the spinner (and any dim a page hangs
// off `:has([data-pending])`) covers the server round-trip that otherwise
// reads as a frozen page.
function TabPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className={styles.spinner} data-pending="true" aria-hidden="true" />
  ) : null;
}

// The keycap tab strip both the players list and the player page switch stat
// views with: one nav, one link per view, the active one lifted and current.
export function StatViewTabs({ label, entries }: { label: string; entries: StatViewTabEntry[] }) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.key} className={styles.item}>
            <Link
              href={entry.href}
              className={styles.link}
              aria-current={entry.isActive ? "page" : undefined}
              data-active={entry.isActive ? "true" : undefined}
            >
              {entry.label}
              <TabPending />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
