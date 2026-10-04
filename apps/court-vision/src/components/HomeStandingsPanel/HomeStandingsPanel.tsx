import { type ConferenceStandings, type ConferenceTeamStanding } from "@/lib/standings/standings";

import styles from "@/components/HomeStandingsPanel/HomeStandingsPanel.module.scss";

// The playoff seeds are the compact story: eight rows per conference keeps the
// panel level with its neighbours instead of listing all fifteen teams.
export const HOME_STANDINGS_LIMIT = 8;

export type HomeStandingsPanelProps = {
  standings: ConferenceStandings | null;
  // Lets the page's grid place the panel; the panel itself stays
  // container-agnostic.
  className?: string;
};

function ConferenceLadder({
  label,
  teams,
}: {
  label: string;
  teams: readonly ConferenceTeamStanding[];
}) {
  return (
    <section className={styles.conference} aria-label={`${label}ern Conference`}>
      <h3 className={styles.conferenceTitle}>{label}</h3>
      <ol className={styles.list}>
        {teams.slice(0, HOME_STANDINGS_LIMIT).map((team) => (
          <li key={team.teamId} className={styles.row}>
            <span className={styles.rank}>{team.rank}</span>
            <abbr className={styles.team} title={team.fullName}>
              {team.abbreviation}
            </abbr>
            <span className={styles.record}>
              {team.wins}-{team.losses}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomeStandingsPanel({ standings, className }: HomeStandingsPanelProps) {
  return (
    <section
      className={[styles.panel, className].filter(Boolean).join(" ")}
      aria-labelledby="home-standings-title"
    >
      <h2 id="home-standings-title" className={styles.title}>
        Conference Standings
      </h2>
      {standings === null ? (
        <p className={styles.empty}>Standings are unavailable right now.</p>
      ) : (
        <>
          <div className={styles.conferences}>
            <ConferenceLadder label="East" teams={standings.east} />
            <ConferenceLadder label="West" teams={standings.west} />
          </div>
          <p className={styles.footnote}>Top {HOME_STANDINGS_LIMIT} seeds by conference rank.</p>
        </>
      )}
    </section>
  );
}
