import Link from "next/link";

import { DashboardPanel, DashboardPanelEmpty } from "@/components/DashboardPanel/DashboardPanel";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { formatScore } from "@vision/core/util/format";
import { rankRoster } from "@/lib/fantasyTeams/rank";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

import styles from "@/components/HomeTeamPanel/HomeTeamPanel.module.scss";

// Fantasy teams live in the database (lib/leagues/teamQueries.ts); the home
// page picks the featured team (lib/fantasyTeams/featured.ts) server-side and
// hands it down here, so this panel and the page's Roster readout always
// describe the same team. Every rostered player is listed, bench and IL
// included, highest season value first, so the roster reads as a ranking.
export type HomeTeamPanelProps = {
  team: FantasyTeam | null;
  // The active league is imported: its teams are Yahoo's, so there is no
  // builder to point at.
  isImported: boolean;
  // Season value by player id on the user's method; a player missing from it
  // has no games yet and sorts last.
  values: ReadonlyMap<number, number>;
  // The method's short label, for the value column's accessible name.
  methodLabel: string;
  // Lets the page's grid place the panel; the panel itself stays
  // container-agnostic.
  className?: string;
};

export function HomeTeamPanel({
  team,
  isImported,
  values,
  methodLabel,
  className,
}: HomeTeamPanelProps) {
  if (team === null) {
    return (
      <DashboardPanel id="home-team-title" title="Your Team" className={className}>
        <DashboardPanelEmpty>
          {isImported ? (
            "No fantasy teams yet."
          ) : (
            <>
              No fantasy teams yet — <Link href="/my-teams/create">create your first team</Link>.
            </>
          )}
        </DashboardPanelEmpty>
      </DashboardPanel>
    );
  }

  const roster = rankRoster({ team, values });

  return (
    <DashboardPanel id="home-team-title" title="Your Team" className={className}>
      {/* An imported team is read-only, so it opens the list, not the builder. */}
      <Link
        href={team.isImported ? "/my-teams" : `/my-teams/${team.slug}`}
        className={styles.teamName}
      >
        {team.name}
      </Link>
      <p className={styles.meta}>
        {roster.length}/{team.slots.length} slots filled · sorted by {methodLabel}
      </p>
      <ol className={styles.slotList}>
        {roster.map(({ slotId, slotLabel, player, value }) => (
          <li key={slotId} className={styles.slot}>
            <PlayerAvatar
              fullName={player.fullName}
              nbaPersonId={player.nbaPersonId}
              size="sm"
              teamAbbr={player.teamAbbr}
            />
            <Link href={`/players/${player.playerId}`} className={styles.name}>
              {player.fullName}
            </Link>
            <span className={styles.slotType}>{slotLabel}</span>
            <span className={styles.value}>
              <span className={styles.srOnly}>{methodLabel} </span>
              {value === null ? "—" : formatScore({ value })}
            </span>
          </li>
        ))}
      </ol>
    </DashboardPanel>
  );
}
