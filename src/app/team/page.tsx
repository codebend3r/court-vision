import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { getTeamRoster, getTeamStats } from "@/lib/teams/loader";
import { teamBySlug } from "@/lib/teams/meta";
import { loadTeamSearchParams } from "@/lib/teams/searchParams";
import { ordinal, rankTeams, TEAM_STAT_META } from "@/lib/teams/stats";

import styles from "@/app/team/page.module.scss";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { is } = await loadTeamSearchParams(searchParams);
  const team = teamBySlug(is);

  if (team === undefined) {
    return (
      <main className={styles.page}>
        <h1>Team</h1>
        <p className={styles.notice}>
          No team matches “{is}”. <Link href="/teams">Browse all teams</Link>.
        </p>
      </main>
    );
  }

  const [{ season, stats }, roster] = await Promise.all([
    getTeamStats(),
    getTeamRoster({ abbr: team.abbr }),
  ]);
  const teamStats = stats.find((entry) => entry.abbr === team.abbr);
  const ranks = rankTeams({ stats }).get(team.abbr);
  const leagueSize = stats.length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <TeamChip team={team.abbr} />
        <span className={styles.identity}>
          <h1 className={styles.name}>{team.name}</h1>
          <span className={styles.context}>
            {team.division} Division · {team.conference}ern Conference
            {!!season && <> · {season} regular season</>}
          </span>
        </span>
        {!!teamStats && (
          <span className={styles.record}>
            {teamStats.wins}–{teamStats.losses}
          </span>
        )}
      </header>
      <section className={styles.content}>
        {roster.length > 0 && (
          <section className={styles.rosterCard}>
            <h2 className={styles.rosterTitle}>Roster</h2>
            <ul className={styles.rosterList}>
              {roster.map((player) => (
                <li key={player.id}>
                  <Link href={`/players/${player.id}`} className={styles.rosterRow}>
                    <PlayerAvatar
                      fullName={player.fullName}
                      nbaPersonId={player.nbaPersonId}
                      size="sm"
                      teamAbbr={player.teamAbbr}
                    />
                    <span className={styles.rosterName}>{player.fullName}</span>
                    <span className={styles.rosterPosition}>{player.position ?? "—"}</span>
                    <span className={styles.rosterJersey}>
                      {player.jerseyNumber === null ? "" : `#${player.jerseyNumber}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {teamStats === undefined ? (
          <p className={styles.notice}>
            No game data for this team yet — the season data hasn&apos;t been synced.
          </p>
        ) : (
          <section className={styles.statsCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Stat</th>
                  <th className={styles.numeric}>Value</th>
                  <th className={styles.numeric}>League rank</th>
                </tr>
              </thead>
              <tbody>
                {TEAM_STAT_META.map((meta) => {
                  const rank = ranks?.[meta.key];
                  return (
                    <tr key={meta.key}>
                      <td>
                        <span className={styles.statLabel}>{meta.label}</span>
                        <span className={styles.statDescription}>{meta.description}</span>
                      </td>
                      <td className={styles.numeric}>{meta.format(teamStats[meta.key])}</td>
                      <td
                        className={styles.numeric}
                        data-top={!!rank && rank <= 5 ? "true" : undefined}
                      >
                        {rank === undefined ? "—" : `${ordinal(rank)} of ${leagueSize}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </section>
      <p className={styles.back}>
        <Link href="/teams">← All teams</Link>
      </p>
    </main>
  );
}
