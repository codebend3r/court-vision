import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { slotMeta } from "@/lib/fantasyTeams/slots";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

import styles from "@/components/HomeTeamPanel/HomeTeamPanel.module.scss";

// Fantasy teams now live in the database (lib/leagues/teamQueries.ts); the
// home page fetches the active league's teams server-side and hands them
// down here. Bench and IL are left to /my-teams; the homepage shows starters
// only, for the most recently created team.
export type HomeTeamPanelProps = {
  teams: FantasyTeam[];
  // Lets the page's grid place the panel; the panel itself stays
  // container-agnostic.
  className?: string;
};

export function HomeTeamPanel({ teams, className }: HomeTeamPanelProps) {
  const latest = [...teams].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const panelClass = [styles.panel, className].filter(Boolean).join(" ");

  if (latest === undefined) {
    return (
      <section className={panelClass} aria-labelledby="home-team-title">
        <h2 id="home-team-title" className={styles.title}>
          Your Team
        </h2>
        <p className={styles.empty}>
          No fantasy teams yet — <Link href="/my-teams/create">create your first team</Link>.
        </p>
      </section>
    );
  }

  const filled = latest.slots.filter((slot) => slot.player !== null).length;
  const starters = latest.slots.filter((slot) => slotMeta(slot.type).kind === "starter");

  return (
    <section className={panelClass} aria-labelledby="home-team-title">
      <h2 id="home-team-title" className={styles.title}>
        Your Team
      </h2>
      <Link href={`/my-teams/${latest.slug}`} className={styles.teamName}>
        {latest.name}
      </Link>
      <p className={styles.meta}>
        {filled}/{latest.slots.length} slots filled
      </p>
      <ul className={styles.slotList}>
        {starters.map((slot) => (
          <li key={slot.id} className={styles.slot}>
            <span className={styles.slotType}>{slotMeta(slot.type).label}</span>
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
    </section>
  );
}
