import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import styles from "@/app/players/[playerId]/page.module.scss";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayerGameLogTable } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { SeasonSelect } from "@/components/SeasonSelect/SeasonSelect";
import { SeasonStatCard } from "@/components/SeasonStatCard/SeasonStatCard";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { SEASON_LABEL, SEASON_TYPE } from "@/lib/balldontlie/constants";
import {
  formatBirthDate,
  formatDraft,
  formatExperience,
  formatHeight,
  formatWeight,
} from "@/lib/players/format";
import {
  aggregateCareerTotals,
  buildCareerAverageLine,
  buildSeasonAverageLine,
  type SeasonAverageStat,
} from "@/lib/players/seasonAverages";
import { prisma } from "@/lib/prisma";
import { buildStatSeries } from "@/lib/stats/cumulative";
import {
  CAREER,
  gamesForSpan,
  loadStatFilters,
  resolveSeasonSelection,
} from "@/lib/stats/searchParams";

export const dynamic = "force-dynamic";

// Player.id is a Postgres INT4; anything outside its range would make Prisma
// throw (a 500) instead of rendering a 404.
const MAX_INT4 = 2147483647;

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { playerId } = await params;
  if (!/^\d+$/.test(playerId)) {
    notFound();
  }
  const numericId = Number.parseInt(playerId, 10);
  if (!Number.isSafeInteger(numericId) || numericId < 1 || numericId > MAX_INT4) {
    notFound();
  }
  const player = await prisma.player.findUnique({ where: { id: numericId } });
  if (player === null) {
    notFound();
  }

  const {
    mode,
    span,
    season: requestedSeason,
  } = await loadStatFilters(searchParams ?? Promise.resolve({}));

  // The player's own season rows drive the dropdown options, the default
  // selection (their most recent season), and the career totals.
  const playerSeasonRows = await prisma.playerSeasonStats.findMany({
    where: { playerId: numericId, seasonType: SEASON_TYPE },
    orderBy: { season: "desc" },
  });
  const playerSeasons = [...new Set(playerSeasonRows.map((row) => row.season))];
  const selection = resolveSeasonSelection({ requested: requestedSeason, playerSeasons });
  const isCareer = selection === CAREER;

  // Every downstream view (games count, chart, log table) is scoped to the
  // selection at the query level; career keeps the full history.
  const logs = await prisma.playerGameLog.findMany({
    where: isCareer ? { playerId: numericId } : { playerId: numericId, season: selection },
    orderBy: { gameDate: "asc" },
  });
  // Games played counts appearances only, not DNPs (0-minute roster games).
  const gamesPlayed = logs.filter((log) => log.minutes > 0).length;

  let statLine: SeasonAverageStat[] = [];
  if (isCareer) {
    const careerTotals = aggregateCareerTotals({ rows: playerSeasonRows, playerId: numericId });
    statLine = careerTotals ? buildCareerAverageLine({ totals: careerTotals }) : [];
  } else {
    // The whole qualified pool is needed to place this player's averages on the
    // league leaderboards, not just their own row.
    const seasonRows = await prisma.playerSeasonStats.findMany({
      where: { season: selection, seasonType: SEASON_TYPE },
    });
    statLine = buildSeasonAverageLine({ rows: seasonRows, playerId: numericId }) ?? [];
  }

  const newestSeason = playerSeasons[0] ?? null;
  const oldestSeason = playerSeasons[playerSeasons.length - 1] ?? null;
  // The card labels the career with its actual data span (the backfill only
  // reaches 2020-21), so a veteran's card doesn't imply a full career.
  const careerSpanLabel =
    oldestSeason && oldestSeason !== newestSeason
      ? `${oldestSeason} to ${newestSeason ?? ""}`
      : (newestSeason ?? SEASON_LABEL);

  const windowSize = gamesForSpan({ span });
  const windowLogs = windowSize === null ? logs : logs.slice(-windowSize);
  const series = buildStatSeries({ logs: windowLogs, mode });

  const isPresentFact = (fact: {
    label: string;
    value: string | null;
  }): fact is { label: string; value: string } => !!fact.value;
  const facts = [
    { label: "Height", value: formatHeight({ heightInches: player.heightInches }) },
    { label: "Weight", value: formatWeight({ weightLbs: player.weightLbs }) },
    { label: "Born", value: formatBirthDate({ birthDate: player.birthDate }) },
    { label: "Country", value: player.country },
    { label: "College", value: player.college },
    {
      label: "Draft",
      value: formatDraft({
        draftYear: player.draftYear,
        draftRound: player.draftRound,
        draftNumber: player.draftNumber,
      }),
    },
    {
      label: "Experience",
      value: formatExperience({
        draftYear: player.draftYear,
        seasonStartYear: Number.parseInt(SEASON_LABEL, 10),
      }),
    },
  ].filter(isPresentFact);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <PlayerAvatar
          fullName={player.fullName}
          nbaPersonId={player.nbaPersonId}
          size="lg"
          teamAbbr={player.teamAbbr}
        />
        <span className={styles.headerText}>
          <h1>{player.fullName}</h1>
          <p className={styles.meta}>
            {!!player.teamAbbr && <TeamChip team={player.teamAbbr} size="sm" />}
            {!!player.position && <span>{player.position}</span>}
            {!!player.jerseyNumber && <span>#{player.jerseyNumber}</span>}
            {playerSeasons.length > 0 ? (
              <>
                <SeasonSelect seasons={playerSeasons} value={selection} />
                <span>{gamesPlayed} games</span>
              </>
            ) : (
              <span>
                {isCareer ? "Career" : selection} · {gamesPlayed} games
              </span>
            )}
          </p>
          {facts.length > 0 && (
            <dl className={styles.facts}>
              {facts.map(({ label, value }) => (
                <div key={label} className={styles.fact}>
                  <dt className={styles.factLabel}>{label}</dt>
                  <dd className={styles.factValue}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </span>
        {statLine.length > 0 && (
          <div className={styles.headerCard}>
            <SeasonStatCard
              season={isCareer ? careerSpanLabel : selection}
              stats={statLine}
              title={isCareer ? "Career averages" : "Season averages"}
            />
          </div>
        )}
      </header>
      {series.length === 0 ? (
        <p className={styles.empty}>
          {/* An empty single-season view blames the season (the dropdown can
              recover); career or a player with no data at all blames the player. */}
          No game logs for this {isCareer || playerSeasons.length === 0 ? "player" : "season"} yet.
        </p>
      ) : (
        <>
          <PlayerStatFilters />
          <PlayerStatChart series={series} mode={mode} />
          <PlayerGameLogTable
            rows={logs.map((log, index) => ({
              ...log,
              gameNumber: index + 1,
              gameDate: log.gameDate.toISOString(),
            }))}
          />
        </>
      )}
    </main>
  );
}
