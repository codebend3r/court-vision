import Link from "next/link";

import { PlayerPositionText } from "@/components/PositionTag/PositionTag";
import { DashboardPanel, DashboardPanelEmpty } from "@/components/DashboardPanel/DashboardPanel";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { type WatchlistPlayerSummary } from "@/lib/watchlist/types";

import styles from "@/components/HomeStarredPanel/HomeStarredPanel.module.scss";

export type HomeStarredPanelProps = {
  players: readonly WatchlistPlayerSummary[];
  count: number;
  // Lets the page's grid place the panel; the panel itself stays
  // container-agnostic.
  className?: string;
};

// The homepage's loudest panel: the players this user actually follows, most
// recently starred first. Rendered only for signed-in users, so every star here
// is actionable.
export function HomeStarredPanel({ players, count, className }: HomeStarredPanelProps) {
  return (
    <DashboardPanel id="home-watchlist-title" title="Starred Players" className={className}>
      {players.length === 0 ? (
        <DashboardPanelEmpty>
          You aren&apos;t watching any players yet — star players from the{" "}
          <Link href="/players">Players</Link> page.
        </DashboardPanelEmpty>
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
                <span className={styles.meta}>
                  <PlayerPositionText playerId={player.playerId} position={player.position} />
                </span>
                <StarButton playerId={player.playerId} fullName={player.fullName} isSignedIn />
              </li>
            ))}
          </ul>
          <Link href="/watchlist" className={styles.viewAll}>
            View all ({count})
          </Link>
        </>
      )}
    </DashboardPanel>
  );
}
