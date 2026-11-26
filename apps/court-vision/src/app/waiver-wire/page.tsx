import { redirect } from "next/navigation";

import { WaiverWireView } from "@/components/WaiverWireView/WaiverWireView";
import { getProfile } from "@/lib/auth/session";
import { getActiveRosterPlayers } from "@/lib/fantasyTeams/loader";
import { getActiveLeague } from "@/lib/leagues/queries";
import { type BlockedRosterGateKind, rosterGate } from "@/lib/leagues/rosterGate";
import { type RawSearchParams } from "@/lib/players/searchParams";
import { leagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { getFantasyPool } from "@/lib/valuation/loader";
import { getWaiverLeagueData } from "@/lib/waiverWire/loader";
import { loadWaiverWireSearchParams } from "@/lib/waiverWire/searchParams";
import { notValuedMessage } from "@/lib/yahoo/messages";
import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";

import { LeagueSyncButton, OpenInYahooLink } from "@/app/_league/LeagueGate";
import { rosterGateScreen } from "@/app/_league/rosterGateScreen";
import { WAIVER_WIRE_PAGE_HEADER } from "@/app/waiver-wire/header";

import styles from "@/app/waiver-wire/waiverWire.module.scss";

export const dynamic = "force-dynamic";

// Why the Waiver Wire can't run yet, for each state that blocks it.
const WAIVER_WIRE_GATE_MESSAGES: Record<BlockedRosterGateKind, string> = {
  no_league:
    "No league yet. Import your Yahoo league to see who on the wire beats your weakest players.",
  not_imported:
    "The Waiver Wire needs a league imported from Yahoo, so it knows every team's roster.",
  points: "The Waiver Wire doesn't support points leagues yet.",
};

type WaiverWirePageProps = {
  searchParams: Promise<RawSearchParams>;
};

export default async function WaiverWirePage({ searchParams }: WaiverWirePageProps) {
  const [profile, activeLeague] = await Promise.all([getProfile(), getActiveLeague()]);
  if (profile === null) redirect("/login?next=/waiver-wire");

  const gate = rosterGate({ league: activeLeague });
  if (gate.kind !== "ready") {
    return rosterGateScreen({
      gate,
      header: WAIVER_WIRE_PAGE_HEADER,
      label: "Waiver Wire status",
      messages: WAIVER_WIRE_GATE_MESSAGES,
    });
  }
  const { league, myTeamId } = gate;

  const { range } = loadWaiverWireSearchParams(await searchParams);
  const [lines, leagueData, activeRoster] = await Promise.all([
    getFantasyPool({ range }),
    getWaiverLeagueData({ leagueId: league.id, myTeamId }),
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
            <LeagueSyncButton league={league} />
            {!!league.externalUrl && <OpenInYahooLink href={league.externalUrl} />}
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
