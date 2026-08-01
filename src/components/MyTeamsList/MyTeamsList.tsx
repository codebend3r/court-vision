"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { slotMeta, type SlotKind } from "@/lib/fantasyTeams/slots";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";
import { deleteLeagueTeam } from "@/lib/leagues/teamActions";

import styles from "@/components/MyTeamsList/MyTeamsList.module.scss";

const KIND_TITLES: Record<SlotKind, string> = {
  starter: "Starters",
  bench: "Bench",
  injured: "Injured list",
};

type TeamAccordionProps = {
  team: FantasyTeam;
  onDelete: ({ teamId }: { teamId: string }) => void;
};

function TeamAccordion({ team, onDelete }: TeamAccordionProps) {
  const router = useRouter();
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
          onClick={() => onDelete({ teamId: team.id })}
          className={styles.delete}
        >
          Delete team
        </button>
      </span>
    </details>
  );
}

export type MyTeamsListProps = {
  teams: FantasyTeam[];
  leagueName: string;
};

export function MyTeamsList({ teams, leagueName }: MyTeamsListProps) {
  const router = useRouter();
  // Seeded from props (the server's fetch), then diverges optimistically on
  // delete; router.refresh() re-runs the server page, which flows a fresh
  // `teams` prop back in through this effect.
  const [localTeams, setLocalTeams] = useState(teams);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => setLocalTeams(teams), [teams]);

  const onDelete = ({ teamId }: { teamId: string }) => {
    void deleteLeagueTeam({ teamId }).then((result) => {
      if (result.status !== "ok-deleted") {
        // Nothing was deleted server-side: leave the team in place and say so.
        setErrorMessage("Could not delete the team — try again.");
        return;
      }
      setErrorMessage(null);
      setLocalTeams((current) => current.filter((team) => team.id !== teamId));
      router.refresh();
    });
  };

  return (
    <section className={styles.list}>
      <p className={styles.scope}>League: {leagueName}</p>
      {!!errorMessage && (
        <p role="alert" className={styles.error}>
          {errorMessage}
        </p>
      )}
      {localTeams.length === 0 ? (
        <p className={styles.emptyState}>
          No fantasy teams yet — <Link href="/my-teams/create">create your first team</Link>.
        </p>
      ) : (
        localTeams.map((team) => <TeamAccordion key={team.id} team={team} onDelete={onDelete} />)
      )}
    </section>
  );
}
