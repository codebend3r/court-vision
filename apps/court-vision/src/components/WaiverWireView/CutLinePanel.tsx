"use client";

import { useState } from "react";

import { SortHeader } from "@/components/SortHeader/SortHeader";
import { NoStatsDisclosure } from "@/components/WaiverWireView/SwapBoardPanel";
import { WaiverPlayer } from "@/components/WaiverWireView/WaiverPlayer";
import { type SortColumn } from "@/lib/tableSort";
import { useColumnSort } from "@/lib/useColumnSort";
import { type CutLine, type CutLineEntry, type CutScope } from "@/lib/waiverWire/cutLine";
import { formatValue } from "@/lib/waiverWire/format";
import { CUT_SCOPES } from "@/lib/waiverWire/searchParams";
import { type WaiverOwner, type WaiverRosterEntry } from "@/lib/waiverWire/types";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

const COLUMNS = 4;

const LINE_LABEL = "Cut line: your worst player";
const CAPTION = "Your roster and free agents ranked by value";
export const NO_FREE_AGENTS = "No free agents match this range and position.";

const SCOPE_LABELS: Record<CutScope, string> = {
  all: "My team and free agents",
  fa: "Free agents only",
};

const OWNER_LABELS: Record<WaiverOwner, string> = {
  mine: "You",
  free_agent: "Free agent",
  waivers: "Waivers",
};

type CutRow = Extract<CutLineEntry, { kind: "row" }>;

const ROWS_SHOWN = 25;

const CUT_COLUMNS: readonly SortColumn<CutRow>[] = [
  { key: "rank", firstDir: "asc", valueOf: ({ row }) => row.rank },
  { key: "player", firstDir: "asc", valueOf: ({ row }) => row.fullName },
  { key: "owner", firstDir: "asc", valueOf: ({ row }) => OWNER_LABELS[row.owner] },
  { key: "value", firstDir: "desc", valueOf: ({ row }) => row.value },
];

export type CutLinePanelProps = {
  cutLine: CutLine;
  // Every row of the scope, line and all, however the window is set: what a
  // sort orders, since a window around the line means nothing once the rows
  // are in another order.
  fullLine: CutLine;
  scope: CutScope;
  onScope: ({ scope }: { scope: CutScope }) => void;
  showAll: boolean;
  onShowAll: ({ showAll }: { showAll: boolean }) => void;
  onCompare: ({ fa }: { fa: number }) => void;
  compareHintId: string;
  // My rostered players with no line in the range, listed under the table.
  noStats: WaiverRosterEntry[];
};

// "Show all (3 above, 7 below)", naming only the sides that hide rows.
const showAllLabel = ({ hiddenAbove, hiddenBelow }: Omit<CutLine, "entries">): string => {
  const sides = [
    { count: hiddenAbove, side: "above" },
    { count: hiddenBelow, side: "below" },
  ]
    .filter(({ count }) => count > 0)
    .map(({ count, side }) => `${count} ${side}`);
  return `Show all (${sides.join(", ")})`;
};

// My rows carry the leading bar; free agents above the line are the upgrades.
const rowClassName = ({ entry }: { entry: Extract<CutLineEntry, { kind: "row" }> }) => {
  if (entry.row.owner === "mine") return styles.mine;
  return entry.isUpgrade ? styles.upgrade : undefined;
};

const isFreeAgentEntry = (entry: CutLineEntry): boolean =>
  entry.kind === "row" && entry.row.owner !== "mine";

// Tab C: my roster and the free pool ranked together by value, with the line
// drawn under my lowest-valued player.
export function CutLinePanel({
  cutLine,
  fullLine,
  scope,
  onScope,
  showAll,
  onShowAll,
  onCompare,
  compareHintId,
  noStats,
}: CutLinePanelProps) {
  const { sort, onSort, sorted } = useColumnSort({ columns: CUT_COLUMNS });
  const [shown, setShown] = useState(ROWS_SHOWN);
  // Unsorted, the panel's own window around the line. Sorted, the line and the
  // window go, and every row of the scope comes in the order asked for.
  const sortedRows =
    sort === null ? null : sorted(fullLine.entries.filter((entry) => entry.kind === "row"));
  const entries: CutLineEntry[] =
    sortedRows === null ? cutLine.entries : sortedRows.slice(0, shown);
  const moreRows = sortedRows === null ? 0 : sortedRows.length - entries.length;
  const hasRows = entries.some((entry) => entry.kind === "row");
  const hasFreeAgent = cutLine.entries.some(isFreeAgentEntry);
  const hidden = cutLine.hiddenAbove + cutLine.hiddenBelow;

  return (
    <div className={styles.cut}>
      <fieldset className={styles.keycapGroup}>
        <legend className={styles.legend}>Show</legend>
        {CUT_SCOPES.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.keycap}
            aria-pressed={scope === option}
            onClick={() => onScope({ scope: option })}
          >
            {SCOPE_LABELS[option]}
          </button>
        ))}
      </fieldset>
      {!hasFreeAgent && <p className={styles.empty}>{NO_FREE_AGENTS}</p>}
      {hasRows && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{CAPTION}</caption>
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
                <SortHeader label="Owner" sortKey="owner" sort={sort} onSort={onSort} />
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
              {entries.map((entry) =>
                entry.kind === "line" ? (
                  <tr key="line" className={styles.cutLine}>
                    <th scope="row" colSpan={COLUMNS}>
                      {LINE_LABEL}
                    </th>
                  </tr>
                ) : (
                  <tr key={entry.row.playerId} className={rowClassName({ entry })}>
                    <td className={`${styles.numeric} ${styles.rank}`}>{entry.row.rank}</td>
                    <td>
                      <WaiverPlayer
                        player={entry.row}
                        onCompare={onCompare}
                        compareHintId={compareHintId}
                      />
                    </td>
                    <td>
                      <span className={styles.owner}>
                        <span className={styles.ownerLabel}>{OWNER_LABELS[entry.row.owner]}</span>
                        {entry.isUpgrade && <span className={styles.upgradeTag}>Upgrade</span>}
                      </span>
                    </td>
                    <td className={styles.numeric}>{formatValue({ value: entry.row.value })}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* A disclosure that stays mounted once open, so focus never drops. */}
      {sort === null && (hidden > 0 || showAll) && (
        <button
          type="button"
          className={styles.keycap}
          aria-expanded={showAll}
          onClick={() => onShowAll({ showAll: !showAll })}
        >
          {showAll ? "Show fewer" : showAllLabel(cutLine)}
        </button>
      )}
      {moreRows > 0 && (
        <button
          type="button"
          className={styles.keycap}
          onClick={() => setShown((current) => current + ROWS_SHOWN)}
        >
          Show {Math.min(ROWS_SHOWN, moreRows)} more ({moreRows} left)
        </button>
      )}
      {noStats.length > 0 && <NoStatsDisclosure entries={noStats} compareHintId={compareHintId} />}
    </div>
  );
}
