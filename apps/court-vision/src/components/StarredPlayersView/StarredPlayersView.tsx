import Link from "next/link";

import { PlayersTable, regularColumns } from "@/components/PlayersTable/PlayersTable";
import { getUser } from "@/lib/auth/session";
import { searchPlayers } from "@/lib/players/searchCached";
import { type RegularSearchParams } from "@/lib/players/searchParams";
import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { getWatchlistPlayerIds } from "@/lib/watchlist/queries";

import styles from "@/components/StarredPlayersView/StarredPlayersView.module.scss";

export type StarredPlayersViewProps = {
  params: RegularSearchParams;
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

  // The ids arrive newest star first; ranking reads star order from them.
  const { rows, total, page } = await searchPlayers({ ...params, playerIds });

  return (
    <section className={styles.view}>
      {showCounter && (
        <p className={styles.counter}>
          {playerIds.length} / {MAX_WATCHLIST} starred
        </p>
      )}
      <PlayersTable
        rows={rows}
        columns={regularColumns({ mode: params.mode })}
        params={params}
        page={page}
        isSignedIn
      />
      <p className={styles.summary}>
        {total === 1 ? "1 starred player" : `${total} starred players`}
      </p>
    </section>
  );
}
