import { PlayerName } from "@/components/AdvisorView/PlayerName";
import { formatScore } from "@vision/core/util/format";
import { ownerText } from "@/lib/advisor/format";
import { type AdvisorPlayer, type FreeAgentPick } from "@/lib/advisor/types";

import styles from "@/components/AdvisorView/AdvisorView.module.scss";

export type FreeAgentsPanelProps = {
  freeAgents: readonly FreeAgentPick[];
  drop: AdvisorPlayer | null;
  label: string;
};

// Two to five free agents for the weak category, then who to drop for one.
export function FreeAgentsPanel({ freeAgents, drop, label }: FreeAgentsPanelProps) {
  return (
    <>
      <section className={styles.panel} aria-labelledby="advisor-free-agents">
        <h2 id="advisor-free-agents" className={styles.panelTitle}>
          Free agents for {label}
        </h2>
        {!freeAgents.length ? (
          <p className={styles.message}>No free agent is valued in this range.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Free agents who help {label}, best in it first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.numeric}>
                    {label}
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Value
                  </th>
                  <th scope="col" className={styles.numeric}>
                    {drop === null ? "Over drop" : `Over ${drop.fullName}`}
                  </th>
                </tr>
              </thead>
              <tbody>
                {freeAgents.map((pick) => (
                  <tr key={pick.playerId}>
                    <th scope="row" className={styles.rowHeader}>
                      <PlayerName player={pick} />
                      {!pick.isUpgrade && (
                        <span className={styles.hint}> Helps {label}, not an overall upgrade</span>
                      )}
                    </th>
                    <td>{ownerText({ owner: pick.owner })}</td>
                    <td className={styles.numeric}>{formatScore({ value: pick.categoryScore })}</td>
                    <td className={styles.numeric}>{formatScore({ value: pick.value })}</td>
                    <td className={styles.numeric}>
                      {pick.gainOverDrop === null ? "-" : formatScore({ value: pick.gainOverDrop })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="advisor-drop">
        <h2 id="advisor-drop" className={styles.panelTitle}>
          Who to drop
        </h2>
        {drop === null ? (
          <p className={styles.message}>Nobody on your healthy roster is valued in this range.</p>
        ) : (
          <div className={styles.target}>
            <PlayerName player={drop} />
            <p className={styles.hint}>
              Value {formatScore({ value: drop.value })}, {label}{" "}
              {formatScore({ value: drop.categoryScore })}. Your lowest-value player once their{" "}
              {label} is counted, so dropping them costs the least.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
