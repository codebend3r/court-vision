import Link from "next/link";

import { DashboardPanel, DashboardPanelEmpty } from "@/components/DashboardPanel/DashboardPanel";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { slotMeta } from "@vision/sport-basketball/engine";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

import styles from "@/components/HomeTeamPanel/HomeTeamPanel.module.scss";

// Fantasy teams live in the database (lib/leagues/teamQueries.ts); the home
// page picks the featured team (lib/fantasyTeams/featured.ts) server-side and
// hands it down here, so this panel and the page's Roster readout always
// describe the same team. Bench and IL are left to /my-teams; the homepage
// shows starters only.
export type HomeTeamPanelProps = {
  team: FantasyTeam | null;
  // The active league is imported: its teams are Yahoo's, so there is no
  // builder to point at.
  isImported: boolean;
  // Lets the page's grid place the panel; the panel itself stays
  // container-agnostic.
  className?: string;
};

export function HomeTeamPanel({ team, isImported, className }: HomeTeamPanelProps) {
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

  const filled = team.slots.filter((slot) => slot.player !== null).length;
  const starters = team.slots.filter((slot) => slotMeta({ type: slot.type }).kind === "starter");

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
        {filled}/{team.slots.length} slots filled
      </p>
      <ul className={styles.slotList}>
        {starters.map((slot) => (
          <li key={slot.id} className={styles.slot}>
            <span className={styles.slotType}>{slotMeta({ type: slot.type }).label}</span>
            {slot.player === null ? (
              <span className={styles.emptySlot}>Empty</span>
            ) : (
              <span className={styles.player}>
                <PlayerAvatar
                  fullName={slot.player.fullName}
                  nbaPersonId={slot.player.nbaPersonId}
                  size="sm"
                  teamAbbr={slot.player.teamAbbr}
                />
                <Link href={`/players/${slot.player.playerId}`}>{slot.player.fullName}</Link>
              </span>
            )}
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}
