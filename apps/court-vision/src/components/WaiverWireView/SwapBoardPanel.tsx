"use client";

import { useId, useState } from "react";

import { WaiverPlayer } from "@/components/WaiverWireView/WaiverPlayer";
import { type SwapBoard } from "@/lib/waiverWire/swapBoard";
import { type WaiverModel, type WaiverRosterEntry } from "@/lib/waiverWire/types";
import { formatSigned } from "@vision/core/util/format";
import { Disclosure } from "@vision/ui/components/Disclosure/Disclosure";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

const ROWS_SHOWN = 25;

const NO_UPGRADE = "No free agent beats your weakest player in this range.";
const NO_ROSTER = "No one on your roster has stats in this range. Try a longer range.";

export type SwapBoardPanelProps = {
  board: SwapBoard;
  model: WaiverModel;
  onCompare: ({ fa }: { fa: number }) => void;
};

// My rostered players with no line in the range: listed, never valued, so
// they are not silently missing from "your weakest".
function NoStatsDisclosure({ entries }: { entries: WaiverRosterEntry[] }) {
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
              onCompare={() => {}}
            />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

// Tab A: my weakest players beside the free agents who beat the weakest of
// them, biggest gain first, with the categories the swap moves most.
export function SwapBoardPanel({ board, model, onCompare }: SwapBoardPanelProps) {
  const weakestId = useId();
  const freeId = useId();
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? board.rows : board.rows.slice(0, ROWS_SHOWN);
  const hasMore = rows.length < board.rows.length;

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
                  <th scope="col">Player</th>
                  <th scope="col" className={styles.numeric}>
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.weakest.map((row) => (
                  <tr key={row.playerId} className={styles.mine}>
                    <td>
                      <WaiverPlayer player={row} onCompare={onCompare} />
                    </td>
                    <td className={styles.numeric}>{row.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>{NO_ROSTER}</p>
        )}
        {model.noStats.length > 0 && <NoStatsDisclosure entries={model.noStats} />}
      </section>
      {!!board.target && (
        <section className={styles.panel} aria-labelledby={freeId}>
          <header className={styles.panelHead}>
            <h2 id={freeId} className={styles.panelHeading}>
              Free agents that beat them
            </h2>
            <span className={styles.count}>sorted by gain over {board.target.fullName}</span>
          </header>
          {rows.length > 0 ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Free agent</th>
                    <th scope="col" className={styles.numeric}>
                      Value
                    </th>
                    <th scope="col" className={styles.numeric}>
                      Gain
                    </th>
                    <th scope="col">Categories</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.playerId}>
                      <td>
                        <WaiverPlayer player={row} onCompare={onCompare} />
                      </td>
                      <td className={styles.numeric}>{row.value.toFixed(2)}</td>
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
                              {!chip.improves && <span className={styles.srOnly}> (worse)</span>}
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
          {hasMore && (
            <button type="button" className={styles.keycap} onClick={() => setShowAll(true)}>
              Show all
            </button>
          )}
        </section>
      )}
    </div>
  );
}
