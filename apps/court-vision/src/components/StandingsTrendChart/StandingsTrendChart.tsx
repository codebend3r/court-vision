"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { ChartPlaceholder } from "@/components/ChartPlaceholder/ChartPlaceholder";
import { TeamChip, type TeamAbbreviation } from "@/components/TeamChip/TeamChip";
import { type WinsRow } from "@/lib/teams/trend";

import styles from "@/components/StandingsTrendChart/StandingsTrendChart.module.scss";

export type StandingsTrendChartProps = {
  title: string;
  teams: ReadonlyArray<{ abbr: TeamAbbreviation; name: string }>;
  rows: readonly WinsRow[];
};

// The plot is the only part of this figure that needs recharts, and it has
// nothing to server-render without a measured width. Loading it client-only
// keeps the chart library off /teams' critical path. The summary, the
// labelled plot box, and the legend still arrive in the server HTML, and the
// placeholder holds the box until the plot lands.
const StandingsTrendPlot = dynamic(
  () =>
    import("@/components/StandingsTrendChart/StandingsTrendPlot").then(
      (mod) => mod.StandingsTrendPlot,
    ),
  { ssr: false, loading: () => <ChartPlaceholder /> },
);

export function StandingsTrendChart({ title, teams, rows }: StandingsTrendChartProps) {
  const [pinned, setPinned] = useState<TeamAbbreviation | null>(null);
  const [hovered, setHovered] = useState<TeamAbbreviation | null>(null);

  if (rows.length === 0) return null;

  const active = pinned ?? hovered;
  const lastRow = rows[rows.length - 1];
  const leader = [...teams].sort(
    (a, b) => (lastRow?.[b.abbr] ?? -1) - (lastRow?.[a.abbr] ?? -1),
  )[0];
  const leaderWins = leader === undefined ? 0 : (lastRow?.[leader.abbr] ?? 0);

  const togglePin = ({ abbr }: { abbr: TeamAbbreviation }) =>
    setPinned((current) => (current === abbr ? null : abbr));

  return (
    <figure
      className={styles.figure}
      onKeyDown={(event) => {
        if (event.key === "Escape") setPinned(null);
      }}
    >
      {!!leader && (
        <p className={styles.summary}>
          Best record: {leader.name}, {leaderWins} wins through {rows.length} games.
        </p>
      )}
      <div className={styles.plot} aria-label={`${title} cumulative wins`} role="img">
        <StandingsTrendPlot
          teams={teams}
          rows={rows}
          active={active}
          onHover={({ abbr }) => setHovered(abbr)}
        />
      </div>
      <ul className={styles.legend}>
        {teams.map((team) => {
          const hasData = rows.some((row) => row[team.abbr] !== undefined);
          return (
            <li key={team.abbr}>
              <button
                type="button"
                className={styles.legendChip}
                aria-pressed={pinned === team.abbr}
                data-dimmed={
                  (active !== null && active !== team.abbr) || !hasData ? "true" : undefined
                }
                onClick={() => togglePin({ abbr: team.abbr })}
                onMouseEnter={() => setHovered(team.abbr)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(team.abbr)}
                onBlur={() => setHovered(null)}
              >
                <span aria-hidden="true">
                  <TeamChip team={team.abbr} size="sm" />
                </span>
                <span className={styles.legendName}>{team.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
