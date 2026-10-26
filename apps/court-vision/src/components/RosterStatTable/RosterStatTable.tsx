"use client";

import Link from "next/link";
import { useMemo } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PositionTag } from "@/components/PositionTag/PositionTag";
import { SortHeader } from "@/components/SortHeader/SortHeader";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { type RosterTableColumn, type RosterTableRow } from "@/lib/roster/table";
import { type SortColumn } from "@/lib/tableSort";
import { useColumnSort } from "@/lib/useColumnSort";

import styles from "@/components/RosterStatTable/RosterStatTable.module.scss";

export type RosterStatTableProps = {
  // Names the table for assistive tech.
  label: string;
  rows: readonly RosterTableRow[];
  columns: readonly RosterTableColumn[];
};

// Every player on the team, one stat per column, in slot order until a header
// is clicked. The slot leads, since a starter and an IL stash read differently.
// The columns are the Players page's own, so a number here is spelled exactly
// as it is there.
export function RosterStatTable({ label, rows, columns }: RosterStatTableProps) {
  const sortColumns = useMemo(
    (): SortColumn<RosterTableRow>[] => [
      { key: "slot", firstDir: "asc", valueOf: (row) => row.slotLabel },
      { key: "player", firstDir: "asc", valueOf: (row) => row.fullName },
      ...columns.map((column, index): SortColumn<RosterTableRow> => ({
        key: column.key,
        firstDir: "desc",
        valueOf: (row) => row.cells[index]?.value ?? null,
      })),
    ],
    [columns],
  );
  const { sort, onSort, sorted } = useColumnSort({ columns: sortColumns });

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.tableScroller}>
        <table className={styles.table} aria-label={label}>
          <thead>
            <tr>
              <SortHeader
                label="Slot"
                sortKey="slot"
                sort={sort}
                onSort={onSort}
                className={styles.slot}
              />
              <SortHeader
                label="Player"
                sortKey="player"
                sort={sort}
                onSort={onSort}
                className={styles.player}
              />
              {columns.map((column) => (
                <SortHeader
                  key={column.key}
                  label={column.label}
                  sortKey={column.key}
                  sort={sort}
                  onSort={onSort}
                  align="end"
                  className={styles.numeric}
                  title={column.title}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted(rows).map((row) => (
              <tr key={row.id}>
                <td className={styles.slot}>{row.slotLabel}</td>
                <td className={styles.player}>
                  <span className={styles.playerInner}>
                    <PlayerAvatar
                      fullName={row.fullName}
                      nbaPersonId={row.nbaPersonId}
                      size="sm"
                      teamAbbr={row.teamAbbr}
                    />
                    <span className={styles.playerMeta}>
                      <Link href={`/players/${row.id}`} className={styles.playerName}>
                        {row.fullName}
                      </Link>
                      <span className={styles.playerTags}>
                        {!!row.teamAbbr && <TeamChip team={row.teamAbbr} size="sm" />}
                        {!!row.position && (
                          <PositionTag position={row.position} playerId={row.id} />
                        )}
                      </span>
                    </span>
                  </span>
                </td>
                {row.cells.map((cell, index) => (
                  <td key={columns[index]?.key ?? index} className={styles.numeric}>
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
