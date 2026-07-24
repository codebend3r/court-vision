"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TeamBuilder } from "@/components/TeamBuilder/TeamBuilder";
import { type PlayerInsight } from "@/lib/fantasyTeams/insights";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

import styles from "@/components/TeamEditor/TeamEditor.module.scss";

export type TeamEditorProps = {
  slug: string;
  players: FantasyTeamPlayer[];
  insights?: PlayerInsight[];
};

// Resolves a /my-teams/<slug> URL to a stored team after the store
// rehydrates, then hands the roster to the same builder used for creation.
export function TeamEditor({ slug, players, insights }: TeamEditorProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void Promise.resolve(useFantasyTeamsStore.persist.rehydrate()).then(() => setHydrated(true));
  }, []);
  const teams = useFantasyTeamsStore((state) => state.teams);

  if (!hydrated) {
    return <p className={styles.loading}>Loading team…</p>;
  }

  const team = teams.find((entry) => teamNameToSlug(entry.name) === slug);
  if (team === undefined) {
    return (
      <p className={styles.notice}>
        No team matches “{slug}”. <Link href="/my-teams">Back to My Teams</Link>.
      </p>
    );
  }

  return <TeamBuilder players={players} team={team} insights={insights} />;
}
