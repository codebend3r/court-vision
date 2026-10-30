import { PlayerName } from "@/components/AdvisorView/PlayerName";
import { formatScore } from "@vision/core/util/format";
import { ownerText } from "@/lib/advisor/format";
import { MIN_TREND_GAMES, type TrendingRow } from "@/lib/advisor/trending";

import styles from "@/components/AdvisorView/AdvisorView.module.scss";

export type TrendingPanelProps = { rows: readonly TrendingRow[] };

// The ten free agents whose last ten games run furthest above their season.
export function TrendingPanel({ rows }: TrendingPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="advisor-trending">
      <h2 id="advisor-trending" className={styles.panelTitle}>
        Trending free agents
      </h2>
      <p className={styles.hint}>
        Value over the last 10 games against the whole season, on the same scale. Players need{" "}
        {MIN_TREND_GAMES} recent games to count.
      </p>
      {!rows.length ? (
        <p className={styles.message}>No free agent is trending up right now.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Free agents trending up most, last 10 games against the season
            </caption>
            <thead>
              <tr>
                <th scope="col" className={styles.numeric}>
                  #
                </th>
                <th scope="col">Player</th>
                <th scope="col">Status</th>
                <th scope="col" className={styles.numeric}>
                  Season
                </th>
                <th scope="col" className={styles.numeric}>
                  Last 10
                </th>
                <th scope="col" className={styles.numeric}>
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.playerId}>
                  <td className={styles.numeric}>{index + 1}</td>
                  <th scope="row" className={styles.rowHeader}>
                    <PlayerName player={row} />
                  </th>
                  <td>{ownerText({ owner: { kind: row.owner } })}</td>
                  <td className={styles.numeric}>{formatScore({ value: row.seasonScore })}</td>
                  <td className={styles.numeric}>{formatScore({ value: row.recentScore })}</td>
                  <td className={styles.numeric} data-rising>
                    {formatScore({ value: row.change })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
