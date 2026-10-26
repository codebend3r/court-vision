"use client";

import { useId, useState } from "react";

import { SortHeader } from "@/components/SortHeader/SortHeader";
import { WaiverPlayer } from "@/components/WaiverWireView/WaiverPlayer";
import { type SortColumn } from "@/lib/tableSort";
import { useColumnSort } from "@/lib/useColumnSort";
import { type SwapBoard, type SwapRow } from "@/lib/waiverWire/swapBoard";
import { formatValue } from "@/lib/waiverWire/format";
import { type WaiverModel, type WaiverRosterEntry, type WaiverRow } from "@/lib/waiverWire/types";
import { formatSigned } from "@vision/core/util/format";
import { Disclosure } from "@vision/ui/components/Disclosure/Disclosure";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

const ROWS_SHOWN = 25;

const WEAKEST_COLUMNS: readonly SortColumn<WaiverRow>[] = [
  { key: "player", firstDir: "asc", valueOf: (row) => row.fullName },
  { key: "value", firstDir: "desc", valueOf: (row) => row.value },
];

// "Categories" sorts on how many of its chips are improvements: the swap that
// helps in the most places first.
const FREE_AGENT_COLUMNS: readonly SortColumn<SwapRow>[] = [
  { key: "player", firstDir: "asc", valueOf: (row) => row.fullName },
  { key: "value", firstDir: "desc", valueOf: (row) => row.value },
  { key: "gain", firstDir: "desc", valueOf: (row) => row.gain },
  {
    key: "categories",
    firstDir: "desc",
    valueOf: (row) => row.chips.filter((chip) => chip.improves).length,
  },
];

export const NO_UPGRADE = "No free agent beats your weakest player in this range.";
export const NO_ROSTER = "No one on your roster has stats in this range. Try a longer range.";

type OnCompareProps = { fa: number };

export type SwapBoardPanelProps = {
  board: SwapBoard;
  model: WaiverModel;
  onCompare: ({ fa }: OnCompareProps) => void;
  compareHintId: string;
};

// My rostered players with no line in the range: listed, never valued, so
// they are not silently missing from "your weakest" or the cut line.
type NoStatsDisclosureProps = {
  entries: WaiverRosterEntry[];
  compareHintId: string;
};

export function NoStatsDisclosure({ entries, compareHintId }: NoStatsDisclosureProps) {
  return (
    <Disclosure
      className={styles.noStats}
      summaryClassName={styles.noStatsSummary}
      summary={<span>No stats in this range</span>}
    >
      <ul className={styles.noStatsList}>
        {entries.map((entry) => (
          <li key={entry.playerId}>
            <WaiverPlayer
              player={{
                playerId: entry.playerId,
                fullName: entry.fullName,
                teamAbbr: null,
                position: null,
                owner: "mine",
                injuryStatus: entry.injuryStatus,
              }}
              compareHintId={compareHintId}
            />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

// Tab A: my weakest players beside the free agents who beat the weakest of
// them, biggest gain first, with the categories the swap moves most.
export function SwapBoardPanel({ board, model, onCompare, compareHintId }: SwapBoardPanelProps) {
  const weakestId = useId();
  const freeId = useId();
  const [showAll, setShowAll] = useState(false);
  const weakestSort = useColumnSort({ columns: WEAKEST_COLUMNS });
  const freeSort = useColumnSort({ columns: FREE_AGENT_COLUMNS });
  const sortedBoard = freeSort.sorted(board.rows);
  const rows = showAll ? sortedBoard : sortedBoard.slice(0, ROWS_SHOWN);
  // A disclosure that stays mounted once open, so focus never drops.
  const canExpand = board.rows.length > ROWS_SHOWN;

  return (
    <div className={styles.swap}>
      <section className={styles.panel} aria-labelledby={weakestId}>
        <h2 id={weakestId} className={styles.panelTitle}>
          Your weakest
        </h2>
        {model.weakest.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortHeader
                    label="Player"
                    sortKey="player"
                    sort={weakestSort.sort}
                    onSort={weakestSort.onSort}
                  />
                  <SortHeader
                    label="Value"
                    sortKey="value"
                    sort={weakestSort.sort}
                    onSort={weakestSort.onSort}
                    align="end"
                    className={styles.numeric}
                  />
                </tr>
              </thead>
              <tbody>
                {weakestSort.sorted(model.weakest).map((row) => (
                  <tr key={row.playerId} className={styles.mine}>
                    <td>
                      <WaiverPlayer
                        player={row}
                        onCompare={onCompare}
                        compareHintId={compareHintId}
                      />
                    </td>
                    <td className={styles.numeric}>{formatValue({ value: row.value })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>{NO_ROSTER}</p>
        )}
        {model.noStats.length > 0 && (
          <NoStatsDisclosure entries={model.noStats} compareHintId={compareHintId} />
        )}
      </section>
      {!!board.target && (
        <section className={styles.panel} aria-labelledby={freeId}>
          <header className={styles.panelHead}>
            <h2 id={freeId} className={styles.panelHeading}>
              Free agents that beat them
            </h2>
            <span className={styles.count}>
              {freeSort.sort === null
                ? `sorted by gain over ${board.target.fullName}`
                : `${board.rows.length} free agents`}
            </span>
          </header>
          {rows.length > 0 ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <SortHeader
                      label="Free agent"
                      sortKey="player"
                      sort={freeSort.sort}
                      onSort={freeSort.onSort}
                    />
                    <SortHeader
                      label="Value"
                      sortKey="value"
                      sort={freeSort.sort}
                      onSort={freeSort.onSort}
                      align="end"
                      className={styles.numeric}
                    />
                    <SortHeader
                      label="Gain"
                      sortKey="gain"
                      sort={freeSort.sort}
                      onSort={freeSort.onSort}
                      align="end"
                      className={styles.numeric}
                    />
                    <SortHeader
                      label="Categories"
                      sortKey="categories"
                      sort={freeSort.sort}
                      onSort={freeSort.onSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.playerId}>
                      <td>
                        <WaiverPlayer
                          player={row}
                          onCompare={onCompare}
                          compareHintId={compareHintId}
                        />
                      </td>
                      <td className={styles.numeric}>{formatValue({ value: row.value })}</td>
                      <td className={styles.numeric}>
                        {formatSigned({ value: row.gain, digits: 2 })}
                      </td>
                      <td>
                        <ul className={styles.chips}>
                          {row.chips.map((chip) => (
                            <li
                              key={chip.key}
                              className={styles.chip}
                              data-improves={chip.improves}
                            >
                              {chip.text}
                              <span className={styles.srOnly}>
                                {chip.improves ? " (better)" : " (worse)"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>{NO_UPGRADE}</p>
          )}
          {canExpand && (
            <button
              type="button"
              className={styles.keycap}
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show fewer" : `Show all ${board.rows.length} free agents`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
