"use client";

import Link from "next/link";

import { LinkPending } from "#ui/components/LinkPending/LinkPending";

import styles from "#ui/components/StatViewTabs/StatViewTabs.module.scss";

export type StatViewTabEntry = {
  key: string;
  href: string;
  label: string;
  isActive: boolean;
};

// The keycap tab strip both the players list and the player page switch stat
// views with: one nav, one link per view, the active one lifted and current.
// LinkPending covers the server round-trip that otherwise reads as a frozen
// page: a spinner (and any dim a page hangs off `:has([data-pending])`) from
// the click until the new stats render, announced to screen readers.
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
              <LinkPending announcement={`Loading ${entry.label}`} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
