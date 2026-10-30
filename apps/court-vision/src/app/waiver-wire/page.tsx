import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { MyTeamPicker } from "@/components/MyTeamPicker/MyTeamPicker";
import { SyncYahooButton } from "@/components/SyncYahooButton/SyncYahooButton";
import { WaiverWireView } from "@/components/WaiverWireView/WaiverWireView";
import { getProfile } from "@/lib/auth/session";
import { getActiveRosterPlayers } from "@/lib/fantasyTeams/loader";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { type RawSearchParams } from "@/lib/players/searchParams";
import { leagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { getFantasyPool } from "@/lib/valuation/loader";
import { getWaiverLeagueData } from "@/lib/waiverWire/loader";
import { loadWaiverWireSearchParams } from "@/lib/waiverWire/searchParams";
import { notValuedMessage } from "@/lib/yahoo/messages";
import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";

import { WAIVER_WIRE_PAGE_HEADER } from "@/app/waiver-wire/header";

import styles from "@/app/waiver-wire/waiverWire.module.scss";

export const dynamic = "force-dynamic";

const IMPORT_PATH = "/leagues/import";

// Every state short of the comparison: the page's own header, then why the
// Waiver Wire can't run yet and what to do about it.
type WaiverWireGateProps = { message: string; children?: ReactNode };

function WaiverWireGate({ message, children }: WaiverWireGateProps) {
  return (
    <main className={styles.page}>
      <PageHeader {...WAIVER_WIRE_PAGE_HEADER} />
      <section className={styles.gate} aria-label="Waiver Wire status">
        <p className={styles.message}>{message}</p>
        {children}
      </section>
    </main>
  );
}

type WaiverWirePageProps = {
  searchParams: Promise<RawSearchParams>;
};

export default async function WaiverWirePage({ searchParams }: WaiverWirePageProps) {
  const [profile, league] = await Promise.all([getProfile(), getActiveLeague()]);
  if (profile === null) redirect("/login?next=/waiver-wire");

  if (league === null) {
    return (
      <WaiverWireGate message="No league yet. Import your Yahoo league to see who on the wire beats your weakest players.">
        <PageAction href={IMPORT_PATH}>Import from Yahoo</PageAction>
      </WaiverWireGate>
    );
  }

  if (!league.isImported) {
    return (
      <WaiverWireGate message="The Waiver Wire needs a league imported from Yahoo, so it knows every team's roster.">
        <PageAction href={IMPORT_PATH}>Import from Yahoo</PageAction>
      </WaiverWireGate>
    );
  }

  if (league.scoringType === "h2h_points") {
    return <WaiverWireGate message="The Waiver Wire doesn't support points leagues yet." />;
  }

  if (league.myTeamId === null) {
    const teams = await getLeagueTeams({ leagueId: league.id });
    return (
      <WaiverWireGate message="Which team is yours?">
        <MyTeamPicker leagueId={league.id} teams={teams} />
      </WaiverWireGate>
    );
  }

  const { range } = loadWaiverWireSearchParams(await searchParams);
  const [lines, leagueData, activeRoster] = await Promise.all([
    getFantasyPool({ range }),
    getWaiverLeagueData({ leagueId: league.id, myTeamId: league.myTeamId }),
    getActiveRosterPlayers(),
  ]);
  const { method, config, methodWeights } = leagueValuationSettings({
    league,
    preferredFormula: profile.preferredFormula,
  });

  return (
    <main className={styles.page}>
      <PageHeader
        {...WAIVER_WIRE_PAGE_HEADER}
        eyebrow={`${league.name} · Yahoo`}
        actions={
          <>
            <SyncYahooButton
              leagueId={league.id}
              syncedAt={league.syncedAt}
              syncError={league.syncError}
              syncVia={league.syncVia}
              externalUrl={league.externalUrl}
              autoSyncWhenStale
            />
            {!!league.externalUrl && (
              // The hidden note, read as the description, says the link
              // leaves for a new tab.
              <a
                href={league.externalUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.external}
              >
                Open in Yahoo
                <span className={styles.srOnly}> (opens in new tab)</span>
              </a>
            )}
          </>
        }
      />
      {!!league.unsupportedCategories.length && (
        <p className={styles.warning}>
          {notValuedMessage({ categories: league.unsupportedCategories })}
        </p>
      )}
      <WaiverWireView
        range={range}
        lines={lines}
        league={leagueData}
        activePlayerIds={activeRoster.map((player) => player.playerId)}
        config={config}
        methodWeights={methodWeights}
        method={method}
      />
      <p className={styles.credit}>League data from Yahoo Fantasy</p>
    </main>
  );
}
