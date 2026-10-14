"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { Disclosure } from "@vision/ui/components/Disclosure/Disclosure";
import { groupSlotsByKind, slotMeta } from "@vision/sport-basketball/engine";
import { SLOT_KIND_TITLES } from "@/lib/fantasyTeams/labels";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";
import { deleteLeagueTeam } from "@/lib/leagues/teamActions";

import styles from "@/components/MyTeamsList/MyTeamsList.module.scss";

type TeamAccordionProps = {
  team: FantasyTeam;
  onDelete: ({ teamId }: { teamId: string }) => void;
};

function TeamAccordion({ team, onDelete }: TeamAccordionProps) {
  const router = useRouter();
  const filled = team.slots.filter((slot) => slot.player !== null).length;
  const editHref = `/my-teams/${team.slug}`;

  return (
    <Disclosure
      className={styles.team}
      summaryClassName={styles.summary}
      summary={
        <>
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
        </>
      }
    >
      <span className={styles.body}>
        {groupSlotsByKind({ slots: team.slots }).map((group) => (
          <span key={group.kind} className={styles.group}>
            <span className={styles.groupTitle}>{SLOT_KIND_TITLES[group.kind]}</span>
            <ul className={styles.slotList}>
              {group.slots.map((slot) => (
                <li key={slot.id} className={styles.slot}>
                  <span className={styles.slotType}>{slotMeta({ type: slot.type }).label}</span>
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
                      <Link href={`/players/${slot.player.playerId}`}>{slot.player.fullName}</Link>
                      {!!slot.player.position && (
                        <span className={styles.position}>{slot.player.position}</span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onDelete({ teamId: team.id })}
          className={styles.delete}
        >
          Delete team
        </button>
      </span>
    </Disclosure>
  );
}

export type MyTeamsListProps = {
  teams: FantasyTeam[];
  leagueName: string;
};

export function MyTeamsList({ teams, leagueName }: MyTeamsListProps) {
  const router = useRouter();
  // The server's `teams`, minus a team whose delete has been confirmed but
  // whose refreshed list has not landed yet.
  const [shownTeams, removeShownTeam] = useOptimistic(teams, (current, teamId: string) =>
    current.filter((team) => team.id !== teamId),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onDelete = ({ teamId }: { teamId: string }) => {
    startTransition(async () => {
      const result = await deleteLeagueTeam({ teamId }).catch(() => null);
      if (result === null || result.status !== "ok") {
        // Nothing was deleted server-side: leave the team in place and say so.
        setErrorMessage("Could not delete the team — try again.");
        return;
      }
      setErrorMessage(null);
      startTransition(() => {
        removeShownTeam(teamId);
        router.refresh();
      });
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
      {shownTeams.length === 0 ? (
        <p className={styles.emptyState}>
          No fantasy teams yet — <Link href="/my-teams/create">create your first team</Link>.
        </p>
      ) : (
        shownTeams.map((team) => <TeamAccordion key={team.id} team={team} onDelete={onDelete} />)
      )}
    </section>
  );
}
