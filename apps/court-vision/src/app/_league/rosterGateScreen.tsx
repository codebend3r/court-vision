import { type ReactElement } from "react";

import { MyTeamPicker } from "@/components/MyTeamPicker/MyTeamPicker";
import { type BlockedRosterGateKind, type RosterGate } from "@/lib/leagues/rosterGate";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { type PageHeaderProps } from "@vision/ui/components/PageHeader/PageHeader";

import { ImportFromYahooAction, LeagueGate } from "@/app/_league/LeagueGate";

// Every rosterGate state short of ready, for a screen that reads the league
// roster by roster (/advisor, /waiver-wire): the team picker when no team is
// mine yet, otherwise the screen's own reason it can't run, with the import
// action wherever importing is the fix (everything but a points league).
// A function the page awaits rather than an async child component, so the
// page's one await settles the whole gate (and its team read) up front.
type RosterGateScreenProps = {
  gate: Exclude<RosterGate, { kind: "ready" }>;
  header: PageHeaderProps;
  label: string;
  messages: Record<BlockedRosterGateKind, string>;
};

export const rosterGateScreen = async ({
  gate,
  header,
  label,
  messages,
}: RosterGateScreenProps): Promise<ReactElement> => {
  if (gate.kind === "no_team") {
    const teams = await getLeagueTeams({ leagueId: gate.leagueId });
    return (
      <LeagueGate header={header} label={label} message="Which team is yours?">
        <MyTeamPicker leagueId={gate.leagueId} teams={teams} />
      </LeagueGate>
    );
  }
  return (
    <LeagueGate header={header} label={label} message={messages[gate.kind]}>
      {gate.kind !== "points" && <ImportFromYahooAction />}
    </LeagueGate>
  );
};
