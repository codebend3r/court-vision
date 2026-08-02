"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import styles from "@/components/LeagueList/LeagueList.module.scss";
import { deleteLeague, setActiveLeague } from "@/lib/leagues/actions";
import { MAX_LEAGUES } from "@/lib/leagues/constants";
import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueScoringType, type LeagueSummary } from "@/lib/leagues/types";

const SCORING_TYPE_LABELS: Record<LeagueScoringType, string> = {
  h2h_categories: "H2H Categories",
  h2h_points: "H2H Points",
  roto: "Rotisserie",
};

export type LeagueListProps = {
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
};

// Client list backing /leagues: local state seeded from the server render so
// activate/delete feel instant, then reconciled with props (and mirrored
// into the global store) once router.refresh() re-runs the server page.
export function LeagueList({ leagues, activeLeagueId }: LeagueListProps) {
  const router = useRouter();
  // Seeded from props (the server's fetch), then diverges optimistically on
  // each action; router.refresh() re-runs the server page, which flows a
  // fresh `leagues`/`activeLeagueId` back in through these effects.
  const [localLeagues, setLocalLeagues] = useState(leagues);
  const [localActiveId, setLocalActiveId] = useState(activeLeagueId);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => setLocalLeagues(leagues), [leagues]);
  useEffect(() => setLocalActiveId(activeLeagueId), [activeLeagueId]);

  const setActive = ({ leagueId }: { leagueId: string }) => {
    // Already active: a no-op, not another round trip.
    if (leagueId === localActiveId) return;
    const previousActiveId = useLeaguesStore.getState().activeLeagueId;
    setLocalActiveId(leagueId);
    useLeaguesStore.getState().setActive({ leagueId });
    void setActiveLeague({ leagueId }).then((result) => {
      if (result.status !== "ok") {
        // Revert the optimistic flip; re-read fresh rather than reuse a
        // pre-flip store snapshot, in case something else changed it meanwhile.
        setLocalActiveId(previousActiveId);
        useLeaguesStore.setState({ activeLeagueId: previousActiveId });
        setErrorMessage("Could not switch leagues — try again.");
        return;
      }
      setErrorMessage(null);
      router.refresh();
    });
  };

  const requestDelete = ({ leagueId }: { leagueId: string }) => {
    setPendingDeleteId(leagueId);
  };

  const confirmDelete = ({ leagueId }: { leagueId: string }) => {
    setPendingDeleteId(null);
    void deleteLeague({ leagueId }).then((result) => {
      if (result.status !== "ok") {
        // Nothing was deleted server-side: leave the card in place and say so.
        setErrorMessage("Could not delete the league — try again.");
        return;
      }
      setErrorMessage(null);
      setLocalLeagues((current) => current.filter((league) => league.id !== leagueId));
      const store = useLeaguesStore.getState();
      store.remove({ leagueId });
      // deleteLeague only changes the active pointer when the deleted league
      // WAS active; reflect that here rather than assuming it always moved.
      // store.remove() above may itself have just nulled activeLeagueId, so
      // re-read fresh rather than compare against a pre-remove snapshot.
      const currentActiveId = useLeaguesStore.getState().activeLeagueId;
      if (result.activeLeagueId !== null && result.activeLeagueId !== currentActiveId) {
        store.setActive({ leagueId: result.activeLeagueId });
      }
      router.refresh();
    });
  };

  const atCap = localLeagues.length >= MAX_LEAGUES;

  if (localLeagues.length === 0) {
    return (
      <section className={styles.list}>
        <p className={styles.empty}>Create your first league to start tracking your team.</p>
        <Link href="/leagues/create" className={styles.create}>
          Create league
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.list}>
      {!!errorMessage && (
        <p role="alert" className={styles.error}>
          {errorMessage}
        </p>
      )}
      <div className={styles.header}>
        <p className={styles.count}>
          {localLeagues.length} of {MAX_LEAGUES} leagues
        </p>
        {atCap ? (
          <p className={styles.capNotice}>Limit reached ({MAX_LEAGUES})</p>
        ) : (
          <Link href="/leagues/create" className={styles.create}>
            Create league
          </Link>
        )}
      </div>
      <ul className={styles.cards}>
        {localLeagues.map((league) => {
          const isActive = league.id === localActiveId;
          const isPendingDelete = league.id === pendingDeleteId;
          return (
            <li key={league.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <Link href={`/leagues/${league.slug}`} className={styles.name}>
                  {league.name}
                </Link>
                <span className={styles.badge}>{SCORING_TYPE_LABELS[league.scoringType]}</span>
              </div>
              <p className={styles.meta}>
                {league.teamCount} teams · {league.rosterSlots} slots
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.activeToggle}
                  aria-pressed={isActive}
                  onClick={() => setActive({ leagueId: league.id })}
                >
                  {isActive ? "Active" : "Set active"}
                </button>
                <button
                  type="button"
                  className={styles.delete}
                  aria-label={
                    isPendingDelete ? `Confirm delete ${league.name}` : `Delete ${league.name}`
                  }
                  onClick={() =>
                    isPendingDelete
                      ? confirmDelete({ leagueId: league.id })
                      : requestDelete({ leagueId: league.id })
                  }
                >
                  {isPendingDelete ? "Confirm delete" : "Delete"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
