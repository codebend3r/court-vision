import { FantasyTeamLogo } from "@/components/FantasyTeamLogo/FantasyTeamLogo";
import { type CategoryResult, scoreMatchup } from "@/lib/matchups/standings";
import { type LeagueWeek, type WeekTeam } from "@/lib/matchups/types";

import styles from "@/components/MatchupView/MatchupView.module.scss";

const RESULT_WORDS: Record<CategoryResult, string> = { win: "Win", loss: "Loss", tie: "Tie" };

export type MatchupPanelProps = {
  week: LeagueWeek;
  mine: WeekTeam;
  opponent: WeekTeam;
};

function Side({ team, align }: { team: WeekTeam; align: "start" | "end" }) {
  return (
    <span className={styles.side} data-align={align}>
      <span className={styles.logo}>
        <FantasyTeamLogo name={team.name} logoUrl={team.logoUrl} size="md" />
      </span>
      <span className={styles.sideText}>
        <span className={styles.teamName}>{team.name}</span>
        {!!team.managerName && <span className={styles.manager}>{team.managerName}</span>}
      </span>
    </span>
  );
}

// This week's head-to-head: both teams over the running tally, then every
// category with each side's total and who is ahead. The result is a word as
// well as a tint, so it never rests on colour alone.
export function MatchupPanel({ week, mine, opponent }: MatchupPanelProps) {
  const score = scoreMatchup({ categories: week.categories, mine, theirs: opponent });
  return (
    <section className={styles.panel} aria-label="This week's matchup">
      <header className={styles.matchupHead}>
        <Side team={mine} align="start" />
        <p
          className={styles.score}
          aria-label={`${score.wins} wins, ${score.losses} losses, ${score.ties} ties`}
        >
          <span className={styles.scoreNumber}>{score.wins}</span>
          <span className={styles.scoreDivider} aria-hidden="true">
            -
          </span>
          <span className={styles.scoreNumber}>{score.losses}</span>
          <span className={styles.scoreDivider} aria-hidden="true">
            -
          </span>
          <span className={styles.scoreNumber}>{score.ties}</span>
        </p>
        <Side team={opponent} align="end" />
      </header>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            Week {week.week} categories, {mine.name} against {opponent.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className={styles.numeric}>
                {mine.name}
              </th>
              <th scope="col" className={styles.numeric}>
                {opponent.name}
              </th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {score.rows.map(({ category, mine: minePart, theirs, result }) => (
              <tr key={category.statId} data-result={result}>
                <th scope="row" className={styles.category}>
                  {category.label}
                  {!category.higherIsBetter && <span className={styles.hint}> (lower wins)</span>}
                </th>
                <td className={styles.numeric} data-ahead={result === "win" || undefined}>
                  {minePart}
                </td>
                <td className={styles.numeric} data-ahead={result === "loss" || undefined}>
                  {theirs}
                </td>
                <td className={styles.result}>{RESULT_WORDS[result]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
