import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { type WatchlistPlayerSummary } from "@/lib/watchlist/types";

import styles from "@/components/HomeStarredPanel/HomeStarredPanel.module.scss";

export type HomeStarredPanelProps = {
  players: readonly WatchlistPlayerSummary[];
  count: number;
};

// The homepage's loudest panel: the players this user actually follows, most
// recently starred first. Rendered only for signed-in users, so every star here
// is actionable.
export function HomeStarredPanel({ players, count }: HomeStarredPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="home-watchlist-title">
      <h2 id="home-watchlist-title" className={styles.title}>
        Starred Players
      </h2>
      {players.length === 0 ? (
        <p className={styles.empty}>
          You aren&apos;t watching any players yet — star players from the{" "}
          <Link href="/players">Players</Link> page.
        </p>
      ) : (
        <>
          <ul className={styles.list}>
            {players.map((player) => (
              <li key={player.playerId} className={styles.item}>
                <PlayerAvatar
                  fullName={player.fullName}
                  nbaPersonId={player.nbaPersonId}
                  size="sm"
                  teamAbbr={player.teamAbbr}
                />
                <Link href={`/players/${player.playerId}`} className={styles.name}>
                  {player.fullName}
                </Link>
                {player.teamAbbr === null ? (
                  <span className={styles.meta}>—</span>
                ) : (
                  <TeamChip team={player.teamAbbr} size="sm" />
                )}
                <span className={styles.meta}>{player.position ?? "—"}</span>
                <StarButton playerId={player.playerId} fullName={player.fullName} isSignedIn />
              </li>
            ))}
          </ul>
          <Link href="/watchlist" className={styles.viewAll}>
            View all ({count})
          </Link>
        </>
      )}
    </section>
  );
}
