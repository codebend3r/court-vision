"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { slotMeta } from "@/lib/fantasyTeams/slots";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";

import styles from "@/components/HomeTeamPanel/HomeTeamPanel.module.scss";

// Fantasy teams live in localStorage (lib/fantasyTeams/store.ts), so this panel
// is a client component reading the same store /my-teams uses. Bench and IL are
// left to that page; the homepage shows the starters only.
export function HomeTeamPanel() {
  useEffect(() => {
    void useFantasyTeamsStore.persist.rehydrate();
  }, []);
  const teams = useFantasyTeamsStore((state) => state.teams);
  const latest = [...teams].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (latest === undefined) {
    return (
      <section className={styles.panel} aria-labelledby="home-team-title">
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
    <section className={styles.panel} aria-labelledby="home-team-title">
      <h2 id="home-team-title" className={styles.title}>
        Your Team
      </h2>
      <Link href={`/my-teams/${teamNameToSlug(latest.name)}`} className={styles.teamName}>
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
