"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { type FantasyTableRow } from "@/components/FantasyValueTable/FantasyValueTable";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import {
  formatSigned,
  METHOD_LABELS,
  type MethodKey,
} from "@/components/PlayerFantasyChart/labels";
import { getSeriesPalette } from "@/components/PlayerStatChart/statMeta";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { type FantasySortKey } from "@/lib/valuation/searchParams";

import styles from "@/components/FantasyChartList/FantasyChartList.module.scss";

const METHOD_KEYS: readonly MethodKey[] = ["z", "g"];

export type FantasyChartListProps<Row extends FantasyTableRow> = {
  // Names the section and the list for assistive tech.
  label: string;
  // The one-line caption above the list, explaining what the charts share.
  hint: string;
  rows: readonly Row[];
  sort: FantasySortKey;
  dir: "asc" | "desc";
  isSignedIn: boolean;
  onSort: (args: { sort: FantasySortKey }) => void;
  // Header content over the chart track: whatever labels the x direction.
  bands: ReactNode;
  // The chart itself, drawn inside the row's chart slot.
  renderChart: (args: { row: Row }) => ReactNode;
  // The chart is hover-only, so its reading is spelled out per row.
  describeChart: (args: { row: Row }) => string;
  // Marks the region busy while a layout's data is still arriving.
  busy?: boolean;
  // A status line under the caption (a failed load, say), already marked up.
  notice?: ReactNode;
};

// The Fantasy tab's chart layouts share this list: the same sorted, paged
// rows as the table, each carrying one wide, short chart beside its rank,
// name, and Z/G readouts. The readout headers sort, since there are no table
// headers here; the band labels sit once in the header over every row's
// chart rather than repeating under each one.
export function FantasyChartList<Row extends FantasyTableRow>({
  label,
  hint,
  rows,
  sort,
  dir,
  isSignedIn,
  onSort,
  bands,
  renderChart,
  describeChart,
  busy = false,
  notice,
}: FantasyChartListProps<Row>) {
  const { theme } = useTheme();
  const palette = getSeriesPalette({ theme });
  const colors: Record<MethodKey, string> = { z: palette[0], g: palette[1] };
  const isStatSort = sort !== "firstName" && sort !== "lastName";

  const sortHeader = ({ key }: { key: MethodKey }) => {
    const isActive = sort === key;
    return (
      <button
        type="button"
        onClick={() => onSort({ sort: key })}
        className={styles.sortButton}
        data-active={isActive ? "true" : "false"}
        data-method={key}
      >
        {METHOD_LABELS[key]}
        {isActive && <span aria-hidden="true">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  };

  const readout = ({ key, value }: { key: MethodKey; value: number }) => (
    <span
      className={styles.readout}
      data-method={key}
      data-sort-active={sort === key || undefined}
      data-negative={value < 0 || undefined}
    >
      {formatSigned(value)}
    </span>
  );

  return (
    <section className={styles.root} aria-label={label} aria-busy={busy || undefined}>
      <header className={styles.caption}>
        <p className={styles.hint}>{hint}</p>
        <ul className={styles.legend} aria-label="Series">
          {METHOD_KEYS.map((key) => (
            <li key={key} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ backgroundColor: colors[key] }}
                aria-hidden="true"
              />
              {METHOD_LABELS[key]}
            </li>
          ))}
        </ul>
      </header>
      {notice}
      <div className={styles.wrapper} data-star={isSignedIn ? "true" : "false"}>
        <div className={styles.head}>
          {isSignedIn && <span className={styles.starCell} />}
          <span className={styles.rank} title="Rank in the current sort">
            #
          </span>
          <span className={styles.playerHeading}>Player</span>
          {sortHeader({ key: "z" })}
          {sortHeader({ key: "g" })}
          <span className={styles.bands}>{bands}</span>
        </div>
        <ol className={styles.list} aria-label={label}>
          {rows.map((row) => (
            <li key={row.playerId} className={styles.row}>
              {isSignedIn && (
                <span className={styles.starCell}>
                  <StarButton playerId={row.playerId} fullName={row.fullName} isSignedIn />
                </span>
              )}
              <span className={styles.rank}>{isStatSort && row.rank}</span>
              <span className={styles.player}>
                <PlayerAvatar
                  fullName={row.fullName}
                  nbaPersonId={row.nbaPersonId}
                  size="sm"
                  teamAbbr={row.teamAbbr}
                />
                <span className={styles.identity}>
                  <Link href={`/players/${row.playerId}`} className={styles.name}>
                    {row.fullName}
                  </Link>
                  <span className={styles.meta}>
                    {row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}
                    {!!row.position && <span>{row.position}</span>}
                  </span>
                </span>
              </span>
              {readout({ key: "z", value: row.values.z })}
              {readout({ key: "g", value: row.values.g })}
              {/* A div, not a span: recharts renders block-level divs inside. */}
              <div className={styles.chart} role="img" aria-label={describeChart({ row })}>
                {renderChart({ row })}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
