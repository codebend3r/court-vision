"use client";

import Link from "next/link";
import { PlayerPositionText } from "@/components/PositionTag/PositionTag";
import { type ReactNode } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import {
  METHOD_KEYS,
  METHOD_LABELS,
  methodColors,
  type MethodColors,
} from "@/components/PlayerFantasyChart/labels";
import { SortButton } from "@/components/SortButton/SortButton";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { useTheme } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { formatSigned } from "@vision/core/util/format";
import { isNameSort } from "@/lib/players/rank";
import { type FantasyTableRow, type ListSortProps } from "@/lib/valuation/fantasyRows";

import styles from "@/components/FantasyChartList/FantasyChartList.module.scss";

export type FantasyChartListProps<Row extends FantasyTableRow> = ListSortProps & {
  // Names the region for assistive tech; the list inside is "Players".
  label: string;
  // The one-line caption above the list, explaining what the charts share.
  hint: string;
  rows: readonly Row[];
  // Header content over the chart track: whatever labels the x direction.
  bands: ReactNode;
  // The chart itself, drawn inside the row's chart slot in the list's Z/G
  // colours.
  renderChart: (args: { row: Row; colors: MethodColors }) => ReactNode;
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
  const colors = methodColors({ theme });
  // Rank only means something when the rows are ordered by a score.
  const showRank = !isNameSort(sort);

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
          {METHOD_KEYS.map((key) => (
            <SortButton
              key={key}
              label={METHOD_LABELS[key]}
              isActive={sort === key}
              dir={dir}
              onClick={() => onSort({ sort: key })}
              className={styles.methodSort}
              data-method={key}
            />
          ))}
          <span className={styles.bands}>{bands}</span>
        </div>
        <ol className={styles.list} aria-label="Players">
          {rows.map((row) => (
            <li key={row.playerId} className={styles.row}>
              {isSignedIn && (
                <span className={styles.starCell}>
                  <StarButton playerId={row.playerId} fullName={row.fullName} isSignedIn />
                </span>
              )}
              <span className={styles.rank}>{showRank && row.rank}</span>
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
                    {!!row.position && (
                      <span>
                        <PlayerPositionText playerId={row.playerId} position={row.position} />
                      </span>
                    )}
                  </span>
                </span>
              </span>
              {METHOD_KEYS.map((key) => (
                <span
                  key={key}
                  className={styles.readout}
                  data-method={key}
                  data-sort-active={sort === key || undefined}
                  data-negative={row.values[key] < 0 || undefined}
                >
                  {formatSigned({ value: row.values[key], digits: 1 })}
                </span>
              ))}
              {/* A div, not a span: recharts renders block-level divs inside. */}
              <div className={styles.chart} role="img" aria-label={describeChart({ row })}>
                {renderChart({ row, colors })}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
