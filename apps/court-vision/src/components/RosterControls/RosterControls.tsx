import Link from "next/link";

import {
  GAME_RANGE_LABELS,
  PLAYER_GAME_RANGES,
  PLAYER_STAT_MODES,
  type PlayerStatMode,
} from "@/lib/players/searchParams";
import { buildRosterHref, type RosterParams } from "@/lib/roster/searchParams";

import styles from "@/components/RosterControls/RosterControls.module.scss";

const MODE_LABELS: Record<PlayerStatMode, string> = { average: "Per game", total: "Totals" };

export type RosterControlsProps = {
  params: RosterParams;
  // Per game or totals only changes the regular stats; advanced ones are averages.
  showMode: boolean;
};

// The window and, for regular stats, the basis the roster is read on. Links,
// not state: each is a server read of a different pool, so each is a real URL
// that survives a refresh and a share, and the tab's own choice stays put.
export function RosterControls({ params, showMode }: RosterControlsProps) {
  return (
    <section className={styles.controls} aria-label="Roster stat options">
      <nav className={styles.group} aria-label="Game range">
        <ul className={styles.list}>
          {PLAYER_GAME_RANGES.map((range) => (
            <li key={range}>
              <Link
                href={buildRosterHref({ ...params, range })}
                className={styles.option}
                aria-current={params.range === range ? "true" : undefined}
                prefetch={false}
              >
                {GAME_RANGE_LABELS[range]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {showMode && (
        <nav className={styles.group} aria-label="Stat basis">
          <ul className={styles.list}>
            {PLAYER_STAT_MODES.map((mode) => (
              <li key={mode}>
                <Link
                  href={buildRosterHref({ ...params, mode })}
                  className={styles.option}
                  aria-current={params.mode === mode ? "true" : undefined}
                  prefetch={false}
                >
                  {MODE_LABELS[mode]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
