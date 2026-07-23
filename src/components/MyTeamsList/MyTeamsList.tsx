"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { slotMeta, type SlotKind } from "@/lib/fantasyTeams/slots";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

import styles from "@/components/MyTeamsList/MyTeamsList.module.scss";

const KIND_TITLES: Record<SlotKind, string> = {
  starter: "Starters",
  bench: "Bench",
  injured: "Injured list",
};

function TeamAccordion({ team }: { team: FantasyTeam }) {
  const router = useRouter();
  const removeTeam = useFantasyTeamsStore((state) => state.removeTeam);
  const filled = team.slots.filter((slot) => slot.player !== null).length;
  const editHref = `/my-teams/${teamNameToSlug(team.name)}`;

  return (
    <details className={styles.team}>
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true">
          ▸
        </span>
        {/* preventDefault stops the summary toggle; navigate manually. */}
        <Link
          href={editHref}
          className={styles.teamName}
          onClick={(event) => {
            event.preventDefault();
            router.push(editHref);
          }}
        >
          {team.name}
        </Link>
        <span className={styles.teamMeta}>
          {filled}/{team.slots.length} slots filled
        </span>
      </summary>
      <span className={styles.body}>
        {(["starter", "bench", "injured"] as const).map((kind) => {
          const kindSlots = team.slots.filter((slot) => slotMeta(slot.type).kind === kind);
          if (kindSlots.length === 0) return null;
          return (
            <span key={kind} className={styles.group}>
              <span className={styles.groupTitle}>{KIND_TITLES[kind]}</span>
              <ul className={styles.slotList}>
                {kindSlots.map((slot) => (
                  <li key={slot.id} className={styles.slot}>
                    <span className={styles.slotType}>{slotMeta(slot.type).label}</span>
                    {slot.player === null ? (
                      <span className={styles.empty}>Empty</span>
                    ) : (
                      <span className={styles.player}>
                        <PlayerAvatar
                          fullName={slot.player.fullName}
                          nbaPersonId={slot.player.nbaPersonId}
                          size="sm"
                          teamAbbr={slot.player.teamAbbr}
                        />
                        <Link href={`/players/${slot.player.playerId}`}>
                          {slot.player.fullName}
                        </Link>
                        {!!slot.player.position && (
                          <span className={styles.position}>{slot.player.position}</span>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => removeTeam({ teamId: team.id })}
          className={styles.delete}
        >
          Delete team
        </button>
      </span>
    </details>
  );
}

export function MyTeamsList() {
  useEffect(() => {
    void useFantasyTeamsStore.persist.rehydrate();
  }, []);
  const teams = useFantasyTeamsStore((state) => state.teams);

  if (teams.length === 0) {
    return (
      <p className={styles.emptyState}>
        No fantasy teams yet — <Link href="/my-teams/create">create your first team</Link>.
      </p>
    );
  }

  return (
    <section className={styles.list}>
      {teams.map((team) => (
        <TeamAccordion key={team.id} team={team} />
      ))}
    </section>
  );
}
