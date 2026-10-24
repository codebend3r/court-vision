"use client";

import { type ChangeEvent, useId } from "react";

import { SortHeader } from "@/components/SortHeader/SortHeader";
import { NO_FREE_AGENTS } from "@/components/WaiverWireView/CutLinePanel";
import { type SortColumn } from "@/lib/tableSort";
import { useColumnSort } from "@/lib/useColumnSort";
import { formatCategoryDelta, formatCategoryValue, formatValue } from "@/lib/waiverWire/format";
import {
  type HeadToHead,
  type HeadToHeadPair,
  type HeadToHeadRow,
  headToHeadSummary,
} from "@/lib/waiverWire/headToHead";
import { type WaiverRow } from "@/lib/waiverWire/types";
import { ReadoutCard, ReadoutRow } from "@vision/ui/components/ReadoutCard/ReadoutCard";

import styles from "@/components/WaiverWireView/HeadToHeadPanel.module.scss";

const CATEGORY_COLUMNS: readonly SortColumn<HeadToHeadRow>[] = [
  { key: "fa", firstDir: "desc", valueOf: (row) => row.faPerGame },
  { key: "mine", firstDir: "desc", valueOf: (row) => row.minePerGame },
  { key: "category", firstDir: "asc", valueOf: (row) => row.label },
  { key: "delta", firstDir: "desc", valueOf: (row) => row.teamDelta },
];

export const NO_PAIR = "Pick a free agent and one of your players to compare.";

// One side of the pair changed; the other stays as the URL has it.
export type HeadToHeadPick = { fa: number } | { mine: number };

export type HeadToHeadPanelProps = {
  pair: HeadToHeadPair | null;
  result: HeadToHead | null;
  freePool: WaiverRow[];
  roster: WaiverRow[];
  onPick: (pick: HeadToHeadPick) => void;
};

// "Wendell Carter Jr. · ORL · C".
const describePlayer = ({ player }: { player: WaiverRow }): string =>
  [player.fullName, player.teamAbbr, player.position]
    .flatMap((part) => (part ? [part] : []))
    .join(" · ");

// The free agent's share of the two per-game numbers, as a percentage. Two
// zeros split the bar evenly.
const faShare = ({ row }: { row: HeadToHeadRow }): number => {
  const total = row.faPerGame + row.minePerGame;
  return total > 0 ? (row.faPerGame / total) * 100 : 50;
};

function PlayerSelect({
  label,
  players,
  selectedId,
  onSelect,
}: {
  label: string;
  players: WaiverRow[];
  selectedId: number | null;
  onSelect: ({ playerId }: { playerId: number }) => void;
}) {
  const id = useId();

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const picked = players.find((player) => String(player.playerId) === event.target.value);
    if (picked) onSelect({ playerId: picked.playerId });
  };

  return (
    <label className={styles.field} htmlFor={id}>
      {label}
      <select
        id={id}
        className={styles.select}
        value={selectedId === null ? "" : String(selectedId)}
        onChange={onChange}
      >
        {players.map((player) => (
          <option key={player.playerId} value={player.playerId}>
            {player.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}

// The free agent's cell carries the decorative bar after their number, so
// the table exposes the same four columns in its header and every row.
function CategoryRow({ row }: { row: HeadToHeadRow }) {
  const share = faShare({ row });
  const faWins = row.winner === "fa";
  const mineWins = row.winner === "mine";
  const delta = formatCategoryDelta({ value: row.teamDelta, kind: row.kind });
  // A change that prints as 0 reads as none, so it claims neither way.
  const improves = delta === "0" ? null : row.teamDeltaImproves;

  return (
    <tr>
      <td className={styles.faCell}>
        <span className={styles.faInner}>
          <span className={styles.value} data-winner={faWins}>
            {faWins && (
              <>
                <span aria-hidden="true">✓</span>{" "}
              </>
            )}
            {formatCategoryValue({ value: row.faPerGame, kind: row.kind })}
            {faWins && <span className={styles.srOnly}> wins</span>}
          </span>
          <span className={styles.bar} aria-hidden="true">
            <span className={styles.barFa} style={{ width: `${share}%` }} />
            <span className={styles.barMine} style={{ width: `${100 - share}%` }} />
          </span>
        </span>
      </td>
      <td className={styles.mineValue} data-winner={mineWins}>
        {formatCategoryValue({ value: row.minePerGame, kind: row.kind })}
        {mineWins && (
          <>
            {" "}
            <span aria-hidden="true">✓</span>
            <span className={styles.srOnly}> wins</span>
          </>
        )}
      </td>
      <th scope="row" className={styles.category}>
        {row.label}
      </th>
      <td className={styles.delta} data-improves={improves ?? undefined}>
        {delta}
        {improves !== null && (
          <>
            {" "}
            <span className={styles.verdict}>{improves ? "better" : "worse"}</span>
          </>
        )}
      </td>
    </tr>
  );
}

// Tab B: one free agent against one of my players, category by category, with
// what the swap does to my team's per-game totals.
export function HeadToHeadPanel({ pair, result, freePool, roster, onPick }: HeadToHeadPanelProps) {
  const { sort, onSort, sorted } = useColumnSort({ columns: CATEGORY_COLUMNS });
  return (
    <div className={styles.panel}>
      <div className={styles.controls}>
        {freePool.length > 0 && (
          <PlayerSelect
            label="Free agent"
            players={freePool}
            selectedId={pair?.fa.playerId ?? null}
            onSelect={({ playerId }) => onPick({ fa: playerId })}
          />
        )}
        {roster.length > 0 && (
          <PlayerSelect
            label="Your player"
            players={roster}
            selectedId={pair?.mine.playerId ?? null}
            onSelect={({ playerId }) => onPick({ mine: playerId })}
          />
        )}
      </div>
      {pair && result ? (
        <>
          <ReadoutRow>
            <ReadoutCard
              label="Free agent"
              value={formatValue({ value: pair.fa.value })}
              note={describePlayer({ player: pair.fa })}
            />
            <ReadoutCard
              label="Your team"
              value={formatValue({ value: pair.mine.value })}
              note={describePlayer({ player: pair.mine })}
            />
          </ReadoutRow>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Per-game categories, {pair.fa.fullName} vs {pair.mine.fullName}
              </caption>
              <thead>
                <tr>
                  <SortHeader
                    label={pair.fa.fullName}
                    sortKey="fa"
                    sort={sort}
                    onSort={onSort}
                    align="end"
                    className={styles.numeric}
                  />
                  <SortHeader
                    label={pair.mine.fullName}
                    sortKey="mine"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader label="Category" sortKey="category" sort={sort} onSort={onSort} />
                  <SortHeader
                    label="Your team after swap"
                    sortKey="delta"
                    sort={sort}
                    onSort={onSort}
                    align="end"
                    className={styles.numeric}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted(result.rows).map((row) => (
                  <CategoryRow key={row.key} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.summary}>{headToHeadSummary({ pair, result })}</p>
        </>
      ) : (
        // With no free agent to pick, say why rather than ask for a pick.
        <p className={styles.empty}>{freePool.length === 0 ? NO_FREE_AGENTS : NO_PAIR}</p>
      )}
    </div>
  );
}
