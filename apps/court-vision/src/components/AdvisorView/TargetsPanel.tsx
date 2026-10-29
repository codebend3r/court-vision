import { PlayerName } from "@/components/AdvisorView/PlayerName";
import { formatScore, ownerText } from "@/lib/advisor/format";
import { isOnAnotherTeam } from "@/lib/advisor/owner";
import { type Advice } from "@/lib/advisor/types";

import styles from "@/components/AdvisorView/AdvisorView.module.scss";

type OnTargetProps = { playerId: number };

export type TargetsPanelProps = {
  advice: Advice;
  onTarget: ({ playerId }: OnTargetProps) => void;
};

// Up to five players who fix the focus, best first, each with what they add
// in every focus category. Choosing one points the Trades tab at them.
export function TargetsPanel({ advice, onTarget }: TargetsPanelProps) {
  const { targets, target, focusLabel } = advice;
  return (
    <section className={styles.panel} aria-labelledby="advisor-targets">
      <h2 id="advisor-targets" className={styles.panelTitle}>
        Best fits for {focusLabel}
      </h2>
      {!targets.length ? (
        <p className={styles.message}>Nobody outside your team is valued in this range.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Players who help {focusLabel} most, best first
            </caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Where</th>
                {advice.focusNeeds.map(({ key, label }) => (
                  <th key={key} scope="col" className={styles.numeric}>
                    {label}
                  </th>
                ))}
                <th scope="col" className={styles.numeric}>
                  Value
                </th>
                <th scope="col">
                  <span className={styles.srOnly}>Trades</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {targets.map((player) => {
                const isChosen = player.playerId === target?.playerId;
                return (
                  <tr key={player.playerId} data-chosen={isChosen || undefined}>
                    <th scope="row" className={styles.rowHeader}>
                      <PlayerName player={player} />
                    </th>
                    <td>{ownerText({ owner: player.owner })}</td>
                    {player.focusScores.map(({ key, score }) => (
                      <td key={key} className={styles.numeric}>
                        {formatScore({ value: score })}
                      </td>
                    ))}
                    <td className={styles.numeric}>{formatScore({ value: player.value })}</td>
                    <td>
                      {isOnAnotherTeam(player.owner) ? (
                        <button
                          type="button"
                          className={styles.keycap}
                          aria-pressed={isChosen}
                          aria-label={`Show trades for ${player.fullName}`}
                          onClick={() => onTarget({ playerId: player.playerId })}
                        >
                          Trades
                        </button>
                      ) : (
                        <span className={styles.hint}>Pick up</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
