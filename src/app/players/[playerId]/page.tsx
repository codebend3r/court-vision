import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayerGameLogTable } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { SeasonSelect } from "@/components/SeasonSelect/SeasonSelect";
import { SeasonStatCard } from "@/components/SeasonStatCard/SeasonStatCard";
import { TeamChip } from "@/components/TeamChip/TeamChip";
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
import { loadSeasonScope, resolveSeasonScope, seasonScopeValue } from "@/lib/players/seasonScope";
import { prisma } from "@/lib/prisma";
import { buildStatSeries } from "@/lib/stats/cumulative";
import { gamesForSpan, loadStatFilters } from "@/lib/stats/searchParams";

import styles from "@/app/players/[playerId]/page.module.scss";

export const dynamic = "force-dynamic";

// Player.id is a Postgres INT4; anything outside its range would make Prisma
// throw (a 500) instead of rendering a 404.
const MAX_INT4 = 2147483647;

const SEASON_TYPE = "Regular Season";
// Only used to date "Experience" when a player has no season rows at all.
const FALLBACK_SEASON = "2025-26";

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

  const rawSearchParams = await (searchParams ?? Promise.resolve({}));

  const logs = await prisma.playerGameLog.findMany({
    where: { playerId: numericId },
    orderBy: { gameDate: "asc" },
  });
  // This player's own per-season totals: the source for aggregating career
  // stats and for the season leaderboard card.
  const playerSeasonRows = await prisma.playerSeasonStats.findMany({
    where: { playerId: numericId, seasonType: SEASON_TYPE },
    orderBy: { season: "desc" },
  });
  // The dropdown is driven by every season the player has data for, whether
  // that's an aggregated season row or just game logs, so it still works before
  // season stats are backfilled. Most recent first.
  const availableSeasons = [
    ...new Set([...playerSeasonRows.map((row) => row.season), ...logs.map((log) => log.season)]),
  ]
    .sort()
    .reverse();

  const { season: requestedSeason } = loadSeasonScope(rawSearchParams);
  const scope = resolveSeasonScope({ requested: requestedSeason, availableSeasons });
  const isCareer = scope.kind === "career";
  const selectedSeason = isCareer ? null : scope.season;
  const scopeLabel = isCareer ? "Career" : scope.season;

  // Every downstream view (games count, chart, log table) is scoped to the
  // selection; career keeps the full history.
  const scopedLogs = isCareer ? logs : logs.filter((log) => log.season === selectedSeason);
  const gamesPlayed = scopedLogs.filter((log) => log.minutes > 0).length;

  let statLine: SeasonAverageStat[] = [];
  if (isCareer) {
    const careerTotals = aggregateCareerTotals({ rows: playerSeasonRows, playerId: numericId });
    statLine = careerTotals ? buildCareerAverageLine({ totals: careerTotals }) : [];
  } else {
    // The whole qualified pool is needed to place this player's averages on the
    // league leaderboards, not just their own row.
    const seasonRows = await prisma.playerSeasonStats.findMany({
      where: { season: selectedSeason ?? "", seasonType: SEASON_TYPE },
    });
    statLine = buildSeasonAverageLine({ rows: seasonRows, playerId: numericId }) ?? [];
  }

  const { mode, span } = loadStatFilters(rawSearchParams);
  const windowSize = gamesForSpan({ span });
  const windowLogs = windowSize === null ? scopedLogs : scopedLogs.slice(-windowSize);
  const series = buildStatSeries({ logs: windowLogs, mode });

  const experienceSeason = selectedSeason ?? availableSeasons[0] ?? FALLBACK_SEASON;

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
        seasonStartYear: Number.parseInt(experienceSeason, 10),
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
            <span>
              {scopeLabel} · {gamesPlayed} games
            </span>
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
              season={scopeLabel}
              stats={statLine}
              title={isCareer ? "Career averages" : "Season averages"}
            />
          </div>
        )}
      </header>
      {availableSeasons.length > 0 && (
        <SeasonSelect seasons={availableSeasons} value={seasonScopeValue(scope)} />
      )}
      {series.length === 0 ? (
        <p className={styles.empty}>No game logs for this {isCareer ? "player" : "season"} yet.</p>
      ) : (
        <>
          <PlayerStatFilters />
          <PlayerStatChart series={series} mode={mode} />
          <PlayerGameLogTable
            rows={scopedLogs.map((log, index) => ({
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
