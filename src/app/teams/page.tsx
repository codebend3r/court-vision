import Link from "next/link";

import { TeamChip } from "@/components/TeamChip/TeamChip";
import {
  CONFERENCE_BY_DIVISION,
  CONFERENCES,
  DIVISIONS,
  TEAM_META,
  type TeamMeta,
} from "@/lib/teams/meta";
import { getTeamStats } from "@/lib/teams/loader";
import { loadTeamsSearchParams, TEAMS_VIEWS, type TeamsView } from "@/lib/teams/searchParams";
import { type TeamSeasonStats } from "@/lib/teams/stats";

import styles from "@/app/teams/page.module.scss";

export const dynamic = "force-dynamic";

const VIEW_LABELS: Record<TeamsView, string> = {
  division: "Division",
  conference: "Conference",
  league: "League",
};

type RawSearchParams = Record<string, string | string[] | undefined>;

type TeamRow = TeamMeta & { stats?: TeamSeasonStats };

const formatRecord = (stats?: TeamSeasonStats): string =>
  stats === undefined ? "—" : `${stats.wins}–${stats.losses}`;

const formatWinPct = (stats?: TeamSeasonStats): string =>
  stats === undefined ? "—" : `${(stats.winPct * 100).toFixed(1)}%`;

// Best record first; alphabetical for teams without data yet.
const byStanding = (a: TeamRow, b: TeamRow): number =>
  (b.stats?.winPct ?? -1) - (a.stats?.winPct ?? -1) ||
  (b.stats?.wins ?? 0) - (a.stats?.wins ?? 0) ||
  a.name.localeCompare(b.name);

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { view } = await loadTeamsSearchParams(searchParams);
  const { season, stats } = await getTeamStats();
  const statsByAbbr = new Map(stats.map((team) => [team.abbr, team]));
  const rows: TeamRow[] = TEAM_META.map((team) => ({
    ...team,
    stats: statsByAbbr.get(team.abbr),
  }));

  const groups: ReadonlyArray<{ title: string; teams: TeamRow[] }> =
    view === "league"
      ? [{ title: "League", teams: [...rows].sort(byStanding) }]
      : view === "conference"
        ? CONFERENCES.map((conference) => ({
            title: `${conference}ern Conference`,
            teams: rows.filter((team) => team.conference === conference).sort(byStanding),
          }))
        : DIVISIONS.map((division) => ({
            title: `${division} (${CONFERENCE_BY_DIVISION[division]})`,
            teams: rows.filter((team) => team.division === division).sort(byStanding),
          }));

  return (
    <main className={styles.page}>
      <h1>Teams</h1>
      <nav className={styles.views} aria-label="Team grouping">
        <ul className={styles.viewList}>
          {TEAMS_VIEWS.map((entry) => (
            <li key={entry}>
              <Link
                href={entry === "division" ? "/teams" : `/teams?view=${entry}`}
                className={styles.viewLink}
                aria-current={entry === view ? "page" : undefined}
                data-active={entry === view ? "true" : undefined}
              >
                {VIEW_LABELS[entry]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {!!season && <p className={styles.season}>{season} regular season</p>}
      <section className={styles.groups}>
        {groups.map((group) => (
          <section key={group.title} className={styles.group}>
            <h2 className={styles.groupTitle}>{group.title}</h2>
            <ol className={styles.teamList}>
              {group.teams.map((team) => (
                <li key={team.abbr}>
                  <Link href={`/team?is=${team.slug}`} className={styles.teamRow}>
                    <TeamChip team={team.abbr} size="sm" />
                    <span className={styles.teamName}>{team.name}</span>
                    <span className={styles.record}>{formatRecord(team.stats)}</span>
                    <span className={styles.winPct}>{formatWinPct(team.stats)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </section>
    </main>
  );
}
