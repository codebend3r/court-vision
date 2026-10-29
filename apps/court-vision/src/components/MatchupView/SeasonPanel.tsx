import Link from "next/link";

import { formatWeeklyAverage, formatWeekRange } from "@/lib/matchups/format";
import { matchupHref } from "@/lib/matchups/searchParams";
import { type SeasonSummary, WEEK_OUTCOME_LABELS } from "@/lib/matchups/season";

import styles from "@/components/MatchupView/MatchupView.module.scss";

export type SeasonPanelProps = { summary: SeasonSummary; teamName: string };

// "1.5" places, or a dash before a week is final.
const formatRank = (value: number | null): string => (value === null ? "-" : value.toFixed(1));

// The season so far: the matchup record over final weeks, every stored week
// with its opponent and score (each a link to that week's head-to-head), then
// every category's record, weekly average and average league place.
export function SeasonPanel({ summary, teamName }: SeasonPanelProps) {
  const { record } = summary;
  return (
    <>
      <section className={styles.panel} aria-label={`${teamName} season record`}>
        <header className={styles.seasonHead}>
          <h2 className={styles.summaryTitle}>Season record</h2>
          <p
            className={styles.score}
            aria-label={`${record.won} won, ${record.lost} lost, ${record.tied} tied`}
          >
            <span className={styles.scoreNumber}>{record.won}</span>
            <span className={styles.scoreDivider} aria-hidden="true">
              -
            </span>
            <span className={styles.scoreNumber}>{record.lost}</span>
            <span className={styles.scoreDivider} aria-hidden="true">
              -
            </span>
            <span className={styles.scoreNumber}>{record.tied}</span>
          </p>
        </header>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Every week of {teamName}&apos;s season</caption>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col">Opponent</th>
                <th scope="col" className={styles.numeric}>
                  Score
                </th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {summary.weeks.map((row) => {
                const range = formatWeekRange(row);
                return (
                  <tr key={row.week} data-outcome={row.outcome}>
                    <th scope="row" className={styles.category}>
                      <Link href={matchupHref({ view: "matchup", week: row.week })}>
                        Week {row.week}
                      </Link>
                      {!!range && <span className={styles.hint}> {range}</span>}
                    </th>
                    <td>{row.opponent?.name ?? "No opponent"}</td>
                    <td className={styles.numeric}>
                      {row.outcome === "bye" ? "-" : `${row.wins}-${row.losses}-${row.ties}`}
                    </td>
                    <td className={styles.result}>{WEEK_OUTCOME_LABELS[row.outcome]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className={styles.panel} aria-label={`${teamName} season by category`}>
        <h2 className={styles.summaryTitle}>By category</h2>
        {summary.finalWeeks === 0 && (
          <p className={styles.hint}>
            No week is final yet. Records and averages fill in once the first week ends.
          </p>
        )}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              {teamName}&apos;s categories over {summary.finalWeeks} final weeks
            </caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className={styles.numeric}>
                  Record
                </th>
                <th scope="col" className={styles.numeric}>
                  Weekly avg
                </th>
                <th scope="col" className={styles.numeric}>
                  Avg league rank
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.categories.map((row) => (
                <tr key={row.category.statId}>
                  <th scope="row" className={styles.category}>
                    {row.category.label}
                    {!row.category.higherIsBetter && (
                      <span className={styles.hint}> (lower wins)</span>
                    )}
                  </th>
                  <td className={styles.numeric}>
                    {row.wins}-{row.losses}-{row.ties}
                  </td>
                  <td className={styles.numeric}>
                    {formatWeeklyAverage({ value: row.weeklyAverage })}
                  </td>
                  <td className={styles.numeric}>{formatRank(row.averageRank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
