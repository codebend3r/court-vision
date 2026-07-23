"use client";

import Link, { useLinkStatus } from "next/link";
import styles from "@/components/PlayersTabs/PlayersTabs.module.scss";
import {
  buildPlayersHref,
  DEFAULT_ADVANCED_SORT_KEY,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_KEY,
  type PlayerGameRange,
  type PlayersTab,
} from "@/lib/players/searchParams";

const TAB_ENTRIES: ReadonlyArray<{ tab: PlayersTab; label: string }> = [
  { tab: "regular", label: "Regular Stats" },
  { tab: "advanced", label: "Advanced Stats" },
  { tab: "fantasy", label: "Fantasy Value" },
];

export type PlayersTabsProps = {
  active: PlayersTab;
  q: string;
  size: number;
  range: PlayerGameRange;
};

// Reflects the in-flight navigation of the enclosing <Link>. Rendered inside a
// Link, `useLinkStatus` flips to pending the moment the tab is clicked and
// clears once the new stats render, so the spinner (and the table dim it drives
// via the page's `:has([data-pending])` rule) covers the server round-trip that
// otherwise reads as a frozen page.
function TabPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className={styles.spinner} data-pending="true" aria-hidden="true" />
  ) : null;
}

export function PlayersTabs({ active, q, size, range }: PlayersTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Player stat views">
      <ul className={styles.list}>
        {TAB_ENTRIES.map((entry) => {
          const isActive = entry.tab === active;
          const href = buildPlayersHref({
            q,
            page: 1,
            size,
            sort: entry.tab === "advanced" ? DEFAULT_ADVANCED_SORT_KEY : DEFAULT_SORT_KEY,
            dir: DEFAULT_SORT_DIR,
            range,
            mode: "average",
            minimums: true,
            tab: entry.tab,
          });
          return (
            <li key={entry.tab} className={styles.item}>
              <Link
                href={href}
                className={styles.link}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive ? "true" : undefined}
              >
                {entry.label}
                <TabPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
