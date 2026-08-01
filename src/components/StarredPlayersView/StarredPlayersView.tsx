import Link from "next/link";

import { PlayersTable } from "@/components/PlayersTable/PlayersTable";
import { getUser } from "@/lib/auth/session";
import { searchPlayers } from "@/lib/players/search";
import { type PlayersSearchParams } from "@/lib/players/searchParams";
import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { getWatchlistPlayerIds } from "@/lib/watchlist/queries";

import styles from "@/components/StarredPlayersView/StarredPlayersView.module.scss";

export type StarredPlayersViewProps = {
  params: PlayersSearchParams;
  showCounter: boolean;
};

// Shared by /watchlist and /players?tab=starred so the two entry points can
// never drift apart. `showCounter` is the only difference: the dedicated page
// owns the "42 / 50 starred" headline, the tab does not.
export async function StarredPlayersView({ params, showCounter }: StarredPlayersViewProps) {
  const user = await getUser();
  if (user === null) {
    return (
      <p className={styles.empty}>
        <Link href="/login?next=%2Fwatchlist">Sign in</Link> to star players.
      </p>
    );
  }

  const playerIds = await getWatchlistPlayerIds();
  if (playerIds.length === 0) {
    return (
      <p className={styles.empty}>
        No starred players yet — star players from the <Link href="/players">Players</Link> page.
      </p>
    );
  }

  const { rows, total, page } = await searchPlayers({ ...params, playerIds });
  // Star order lives in the id list, not the stats query. The set is capped at
  // 50, so applying it here beats teaching the query a join order it otherwise
  // never needs.
  const ordered =
    params.sort === "starredAt"
      ? [...rows].sort((a, b) => {
          const difference = playerIds.indexOf(a.id) - playerIds.indexOf(b.id);
          return params.dir === "asc" ? -difference : difference;
        })
      : rows;

  return (
    <section className={styles.view}>
      {showCounter && (
        <p className={styles.counter}>
          {playerIds.length} / {MAX_WATCHLIST} starred
        </p>
      )}
      <PlayersTable variant="regular" rows={ordered} params={params} page={page} isSignedIn />
      <p className={styles.summary}>
        {total === 1 ? "1 starred player" : `${total} starred players`}
      </p>
    </section>
  );
}
