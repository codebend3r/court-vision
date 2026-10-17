"use client";

import { NoStatsDisclosure } from "@/components/WaiverWireView/SwapBoardPanel";
import { WaiverPlayer } from "@/components/WaiverWireView/WaiverPlayer";
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

export type CutLinePanelProps = {
  cutLine: CutLine;
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
  scope,
  onScope,
  showAll,
  onShowAll,
  onCompare,
  compareHintId,
  noStats,
}: CutLinePanelProps) {
  const hasRows = cutLine.entries.some((entry) => entry.kind === "row");
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
                <th scope="col" className={styles.numeric}>
                  Rank
                </th>
                <th scope="col">Player</th>
                <th scope="col">Owner</th>
                <th scope="col" className={styles.numeric}>
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {cutLine.entries.map((entry) =>
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
      {(hidden > 0 || showAll) && (
        <button
          type="button"
          className={styles.keycap}
          aria-expanded={showAll}
          onClick={() => onShowAll({ showAll: !showAll })}
        >
          {showAll ? "Show fewer" : showAllLabel(cutLine)}
        </button>
      )}
      {noStats.length > 0 && <NoStatsDisclosure entries={noStats} compareHintId={compareHintId} />}
    </div>
  );
}
