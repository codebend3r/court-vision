import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { StarredPlayersView } from "@/components/StarredPlayersView/StarredPlayersView";
import { getActiveLeague } from "@/lib/leagues/queries";
import { parseStarredSearchParams, type RawSearchParams } from "@/lib/players/searchParams";

import styles from "@/styles/leagueScopedPage.module.scss";

export const dynamic = "force-dynamic";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // The tab is fixed: this route is the starred view, whatever the query says.
  const params = parseStarredSearchParams({ raw: await searchParams });
  // null for a signed-out visitor or a signed-in one with no league yet —
  // either way the scope line is simply omitted below.
  const league = await getActiveLeague();

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="My league"
        title="Starred players"
        description="The shortlist you are actually deciding between, ranked by your preferred formula."
      />
      {league !== null && <p className={styles.scope}>League: {league.name}</p>}
      <StarredPlayersView params={params} showCounter />
    </main>
  );
}
