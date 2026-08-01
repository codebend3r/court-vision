import { StarredPlayersView } from "@/components/StarredPlayersView/StarredPlayersView";
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

  return (
    <main className={styles.page}>
      <h1>Starred Players</h1>
      <StarredPlayersView params={params} showCounter />
    </main>
  );
}
