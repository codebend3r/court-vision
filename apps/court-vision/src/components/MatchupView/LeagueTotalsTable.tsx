"use client";

import { useMemo } from "react";

import { FantasyTeamLogo } from "@/components/FantasyTeamLogo/FantasyTeamLogo";
import { SortHeader } from "@/components/SortHeader/SortHeader";
import { averageRank, buildStandings, type CategoryStanding } from "@/lib/matchups/standings";
import { type LeagueWeek, type WeekTeam } from "@/lib/matchups/types";
import { type SortColumn } from "@/lib/tableSort";
import { useColumnSort } from "@/lib/useColumnSort";

import styles from "@/components/MatchupView/MatchupView.module.scss";

type TotalsRow = {
  team: WeekTeam;
  standings: CategoryStanding[];
  average: number | null;
};

const AVERAGE_KEY = "average";
const TEAM_KEY = "team";

const AVERAGE_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type LeagueTotalsTableProps = { week: LeagueWeek; opponentId?: string };

// Every team's week in every category, each total beside the place it earns, so
// a column sorted best-first reads as the league table for that category. A
// category's first click puts its leader on top, turnovers included.
export function LeagueTotalsTable({ week, opponentId }: LeagueTotalsTableProps) {
  const rows = useMemo((): TotalsRow[] => {
    const standingsByTeam = buildStandings({ categories: week.categories, teams: week.teams });
    return week.teams.map((team) => {
      const standings = standingsByTeam.get(team.teamId) ?? [];
      return { team, standings, average: averageRank({ standings }) };
    });
  }, [week]);

  const columns = useMemo(
    (): SortColumn<TotalsRow>[] => [
      { key: TEAM_KEY, firstDir: "asc", valueOf: ({ team }) => team.name },
      { key: AVERAGE_KEY, firstDir: "asc", valueOf: ({ average }) => average },
      ...week.categories.map((category): SortColumn<TotalsRow> => ({
        key: String(category.statId),
        firstDir: "asc",
        // Sorting by place, so the best total leads whichever way the category runs.
        valueOf: ({ standings }) =>
          standings.find((standing) => standing.category.statId === category.statId)?.rank ?? null,
      })),
    ],
    [week.categories],
  );
  const { sort, onSort, sorted } = useColumnSort({ columns });

  return (
    <section className={styles.panel} aria-label="League totals for the week">
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            Week {week.week} totals for every team, with each team&apos;s place in the league in
            each category
          </caption>
          <thead>
            <tr>
              <SortHeader label="Team" sortKey={TEAM_KEY} sort={sort} onSort={onSort} />
              <SortHeader
                label="Avg place"
                sortKey={AVERAGE_KEY}
                sort={sort}
                onSort={onSort}
                align="end"
                className={styles.numeric}
                title="Average place across the categories; lower is stronger"
              />
              {week.categories.map((category) => (
                <SortHeader
                  key={category.statId}
                  label={category.label}
                  sortKey={String(category.statId)}
                  sort={sort}
                  onSort={onSort}
                  align="end"
                  className={styles.numeric}
                  title={category.higherIsBetter ? undefined : "Lower is better"}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted(rows).map(({ team, standings, average }) => (
              <tr
                key={team.teamId}
                data-side={
                  team.isMine ? "mine" : team.teamId === opponentId ? "opponent" : undefined
                }
              >
                <th scope="row" className={styles.teamCell}>
                  {team.isMine && (
                    <span data-on-your-team="true" className={styles.srOnly}>
                      Your team:{" "}
                    </span>
                  )}
                  {!team.isMine && team.teamId === opponentId && (
                    <span className={styles.srOnly}>Your opponent: </span>
                  )}
                  <span className={styles.teamCellInner}>
                    <FantasyTeamLogo name={team.name} logoUrl={team.logoUrl} />
                    <span className={styles.teamName}>{team.name}</span>
                    {team.isMine && (
                      <span className={styles.sideTag} aria-hidden="true">
                        You
                      </span>
                    )}
                    {!team.isMine && team.teamId === opponentId && (
                      <span className={styles.sideTag} aria-hidden="true">
                        Opponent
                      </span>
                    )}
                  </span>
                </th>
                <td className={styles.numeric}>
                  {average === null ? "-" : AVERAGE_FORMAT.format(average)}
                </td>
                {standings.map(({ category, rank, isBest, isWorst }) => (
                  <td
                    key={category.statId}
                    className={styles.numeric}
                    data-sort-active={sort?.key === String(category.statId) || undefined}
                  >
                    <span className={styles.total}>
                      {team.display[String(category.statId)] ?? "-"}
                    </span>
                    <span
                      className={styles.place}
                      data-extreme={isBest ? "best" : isWorst ? "worst" : undefined}
                    >
                      {rank}
                      {isBest && <span className={styles.srOnly}> (best in league)</span>}
                      {isWorst && <span className={styles.srOnly}> (worst in league)</span>}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
