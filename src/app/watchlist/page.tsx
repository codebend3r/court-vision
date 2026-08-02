import { StarredPlayersView } from "@/components/StarredPlayersView/StarredPlayersView";
import { getActiveLeague } from "@/lib/leagues/queries";
import { parsePlayersSearchParams } from "@/lib/players/searchParams";

import styles from "@/app/watchlist/page.module.scss";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  // The tab is fixed: this route is the starred view, whatever the query says.
  const params = parsePlayersSearchParams({
    q: firstValue(raw.q),
    page: firstValue(raw.page),
    size: firstValue(raw.size),
    sort: firstValue(raw.sort),
    dir: firstValue(raw.dir),
    range: firstValue(raw.range),
    mode: firstValue(raw.mode),
    minimums: firstValue(raw.minimums),
    tab: "starred",
  });
  // null for a signed-out visitor or a signed-in one with no league yet —
  // either way the scope line is simply omitted below.
  const league = await getActiveLeague();

  return (
    <main className={styles.page}>
      <h1>Starred Players</h1>
      {league !== null && <p className={styles.scope}>League: {league.name}</p>}
      <StarredPlayersView params={params} showCounter />
    </main>
  );
}
