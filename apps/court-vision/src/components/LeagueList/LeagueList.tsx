"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";

import styles from "@/components/LeagueList/LeagueList.module.scss";
import { deleteLeague } from "@/lib/leagues/actions";
import { MAX_LEAGUES } from "@vision/core/league/constants";
import { SCORING_TYPE_LABELS } from "@/lib/leagues/settings";
import { SWITCH_LEAGUE_ERROR, useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

const DELETE_ERROR = "Could not delete the league — try again.";

// The two ways to add a league: build one by hand, or import one from Yahoo.
// Both go away together at MAX_LEAGUES.
function NewLeagueLinks() {
  return (
    <div className={styles.newLeague}>
      <Link href="/leagues/create" className={styles.create}>
        Create league
      </Link>
      <Link href="/leagues/import" className={styles.create}>
        Import from Yahoo
      </Link>
    </div>
  );
}

export type LeagueListProps = {
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
};

// Client list backing /leagues. Activate and delete show their outcome on the
// click; the optimistic values hold until router.refresh() lands the server's
// own `leagues`/`activeLeagueId`, and fall back to them when an action fails.
export function LeagueList({ leagues, activeLeagueId }: LeagueListProps) {
  const router = useRouter();
  const [shownLeagues, removeShownLeague] = useOptimistic(leagues, (current, leagueId: string) =>
    current.filter((league) => league.id !== leagueId),
  );
  const [shownActiveId, setShownActiveId] = useOptimistic(activeLeagueId);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setActive = ({ leagueId }: { leagueId: string }) => {
    // Already active: a no-op, not another round trip.
    if (leagueId === shownActiveId) return;
    startTransition(async () => {
      setShownActiveId(leagueId);
      const result = await useLeaguesStore.getState().switchActiveLeague({ leagueId });
      if (result.status !== "ok") {
        setErrorMessage(SWITCH_LEAGUE_ERROR);
        return;
      }
      setErrorMessage(null);
      startTransition(() => router.refresh());
    });
  };

  const requestDelete = ({ leagueId }: { leagueId: string }) => {
    setPendingDeleteId(leagueId);
  };

  // The card goes only once the server confirms the delete; a failed (or
  // throwing) delete leaves it in place with an alert.
  const confirmDelete = ({ leagueId }: { leagueId: string }) => {
    setPendingDeleteId(null);
    startTransition(async () => {
      const result = await deleteLeague({ leagueId }).catch(() => null);
      if (result === null || result.status !== "ok") {
        setErrorMessage(DELETE_ERROR);
        return;
      }
      setErrorMessage(null);
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
      startTransition(() => {
        removeShownLeague(leagueId);
        router.refresh();
      });
    });
  };

  const atCap = shownLeagues.length >= MAX_LEAGUES;

  if (shownLeagues.length === 0) {
    return (
      <section className={styles.list}>
        <p className={styles.empty}>Create your first league to start tracking your team.</p>
        <NewLeagueLinks />
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
          {shownLeagues.length} of {MAX_LEAGUES} leagues
        </p>
        {atCap ? (
          <p className={styles.capNotice}>Limit reached ({MAX_LEAGUES})</p>
        ) : (
          <NewLeagueLinks />
        )}
      </div>
      <ul className={styles.cards}>
        {shownLeagues.map((league) => {
          const isActive = league.id === shownActiveId;
          const isPendingDelete = league.id === pendingDeleteId;
          return (
            <li key={league.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <Link href={`/leagues/${league.slug}`} className={styles.name}>
                  {league.name}
                </Link>
                <span className={styles.badge}>{SCORING_TYPE_LABELS[league.scoringType]}</span>
              </div>
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
              {/* Replacement rank matters here: it is what the valuation
                  engine derives from league size (teams × slots). */}
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>Teams</dt>
                  <dd className={styles.factValue}>{league.teamCount}</dd>
                </div>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>Roster slots</dt>
                  <dd className={styles.factValue}>{league.rosterSlots}</dd>
                </div>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>Replacement rank</dt>
                  <dd className={styles.factValue}>#{league.teamCount * league.rosterSlots}</dd>
                </div>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>Scoring</dt>
                  <dd className={styles.factValue}>{SCORING_TYPE_LABELS[league.scoringType]}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
