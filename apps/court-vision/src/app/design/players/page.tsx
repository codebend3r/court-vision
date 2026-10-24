import type { Metadata } from "next";

import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { PlayersPager } from "@/components/PlayersPager/PlayersPager";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { PlayersTable, regularColumns } from "@/components/PlayersTable/PlayersTable";
import { PlayersTabs } from "@/components/PlayersTabs/PlayersTabs";
import { FIXTURE_PLAYERS } from "@/lib/players/fixture";
import { parsePlayersSearchParams } from "@/lib/players/searchParams";

import styles from "@/app/design/players/page.module.scss";

// A synthetic perf fixture, not a product page: nothing here should be indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// The first page of 100 rows, as the real /players renders it at size 100. The
// table, tabs, controls and pager are the production components over fixed
// data, so Lighthouse measures their real client cost without a database.
const params = parsePlayersSearchParams({ raw: { size: "100" } });

export default function DesignPlayersPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Reference"
        title="Players fixture"
        description="A hundred synthetic players through the production players table. It exists so CI can time the list without a database."
      />
      <PlayersTabs
        active={params.tab}
        q={params.q}
        size={params.size}
        range={params.range}
        owner={params.owner}
      />
      <PlayersSearchControls params={params} />
      <section className={styles.results}>
        <p className={styles.summary}>
          Showing 1 to {FIXTURE_PLAYERS.length} of {FIXTURE_PLAYERS.length}
        </p>
        <PlayersTable
          rows={FIXTURE_PLAYERS}
          columns={regularColumns({ mode: params.mode })}
          params={params}
          page={1}
          isSignedIn={false}
          footer={<PlayersPager params={params} page={1} totalPages={1} />}
        />
      </section>
    </main>
  );
}
