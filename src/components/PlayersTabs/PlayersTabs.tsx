import Link from "next/link";

import {
  buildPlayersHref,
  DEFAULT_ADVANCED_SORT_KEY,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_KEY,
  type PlayerGameRange,
  type PlayersTab,
} from "@/lib/players/searchParams";

import styles from "@/components/PlayersTabs/PlayersTabs.module.scss";

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
                {entry.tab === "fantasy" && <span className={styles.badge}>Soon</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
