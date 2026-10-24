"use client";

import { useId, useMemo, useState } from "react";

import { SortHeader } from "@/components/SortHeader/SortHeader";
import { useColumnSort } from "@/lib/useColumnSort";
import { WaiverPlayer } from "@/components/WaiverWireView/WaiverPlayer";
import { type FantasyStatLine } from "@/lib/valuation/types";
import {
  AVAILABLE_COLUMNS,
  availableSortColumns,
  filterAvailable,
} from "@/lib/waiverWire/available";
import { formatValue } from "@/lib/waiverWire/format";
import { type WaiverRow } from "@/lib/waiverWire/types";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

const ROWS_SHOWN = 25;

export const NO_AVAILABLE = "No available players match this range and position.";

export type AvailablePlayersPanelProps = {
  // Everyone nobody in the league has, best value first, already filtered by position.
  freePool: readonly WaiverRow[];
  linesById: ReadonlyMap<number, FantasyStatLine>;
  onCompare: ({ fa }: { fa: number }) => void;
  compareHintId: string;
};

// Tab A: every player no team in the league holds, ranked by value, with the
// categories a league scores beside each name. A name opens them head-to-head
// against your weakest player. Windowed so a pool of hundreds stays one short
// scroll until asked for more.
export function AvailablePlayersPanel({
  freePool,
  linesById,
  onCompare,
  compareHintId,
}: AvailablePlayersPanelProps) {
  const searchId = useId();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(ROWS_SHOWN);
  const columns = useMemo(() => availableSortColumns({ linesById }), [linesById]);
  const { sort, onSort, sorted } = useColumnSort({ columns });
  const matches = sorted(filterAvailable({ rows: freePool, q }));
  const rows = matches.slice(0, shown);
  const remaining = matches.length - rows.length;

  return (
    <section className={styles.available} aria-label="Available players">
      <header className={styles.availableHead}>
        <label className={styles.search} htmlFor={searchId}>
          Search available players
          <input
            id={searchId}
            type="search"
            autoComplete="off"
            spellCheck={false}
            className={styles.searchField}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setShown(ROWS_SHOWN);
            }}
          />
        </label>
        <p className={styles.count} aria-live="polite">
          {matches.length === 1 ? "1 available player" : `${matches.length} available players`}
          {matches.length !== freePool.length && ` of ${freePool.length}`}
        </p>
      </header>
      {rows.length === 0 ? (
        <p className={styles.empty}>
          {freePool.length === 0 ? NO_AVAILABLE : `No available player matches "${q.trim()}".`}
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Players not on any team in your league, ranked by value
            </caption>
            <thead>
              <tr>
                <SortHeader
                  label="Rank"
                  sortKey="rank"
                  sort={sort}
                  onSort={onSort}
                  align="end"
                  className={styles.numeric}
                />
                <SortHeader label="Player" sortKey="player" sort={sort} onSort={onSort} />
                {AVAILABLE_COLUMNS.map((column) => (
                  <SortHeader
                    key={column.label}
                    label={column.label}
                    sortKey={column.label}
                    sort={sort}
                    onSort={onSort}
                    align="end"
                    className={styles.numeric}
                  />
                ))}
                <SortHeader
                  label="Value"
                  sortKey="value"
                  sort={sort}
                  onSort={onSort}
                  align="end"
                  className={styles.numeric}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const line = linesById.get(row.playerId);
                return (
                  <tr key={row.playerId}>
                    <td className={`${styles.numeric} ${styles.rank}`}>{row.rank}</td>
                    <td>
                      <WaiverPlayer
                        player={row}
                        onCompare={onCompare}
                        compareHintId={compareHintId}
                      />
                    </td>
                    {AVAILABLE_COLUMNS.map((column) => (
                      <td key={column.label} className={styles.numeric}>
                        {line === undefined ? "—" : column.cell(line)}
                      </td>
                    ))}
                    <td className={styles.numeric}>{formatValue({ value: row.value })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Stays mounted while there is more, so focus never drops. */}
      {remaining > 0 && (
        <button
          type="button"
          className={styles.keycap}
          onClick={() => setShown((current) => current + ROWS_SHOWN)}
        >
          Show {Math.min(ROWS_SHOWN, remaining)} more ({remaining} left)
        </button>
      )}
    </section>
  );
}
