import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayerGameLogTable } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { SeasonStatCard } from "@/components/SeasonStatCard/SeasonStatCard";
import {
  formatBirthDate,
  formatDraft,
  formatExperience,
  formatHeight,
  formatWeight,
} from "@/lib/players/format";
import { buildSeasonAverageLine } from "@/lib/players/seasonAverages";
import { prisma } from "@/lib/prisma";
import { buildStatSeries } from "@/lib/stats/cumulative";
import { gamesForSpan, loadStatFilters } from "@/lib/stats/searchParams";

import styles from "@/app/players/[playerId]/page.module.scss";

export const dynamic = "force-dynamic";

// Player.id is a Postgres INT4; anything outside its range would make Prisma
// throw (a 500) instead of rendering a 404.
const MAX_INT4 = 2147483647;

const SEASON = "2025-26";
const SEASON_TYPE = "Regular Season";

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
  const logs = await prisma.playerGameLog.findMany({
    where: { playerId: numericId },
    orderBy: { gameDate: "asc" },
  });
  // The whole qualified pool is needed to place this player's averages on the
  // league leaderboards, not just their own row.
  const seasonRows = await prisma.playerSeasonStats.findMany({
    where: { season: SEASON, seasonType: SEASON_TYPE },
  });
  const seasonLine = buildSeasonAverageLine({ rows: seasonRows, playerId: numericId }) ?? [];
  const { mode, span } = await loadStatFilters(searchParams ?? Promise.resolve({}));
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
        seasonStartYear: Number.parseInt(SEASON, 10),
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
              {SEASON} · {logs.length} games
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
        {seasonLine.length > 0 && (
          <div className={styles.headerCard}>
            <SeasonStatCard season={SEASON} stats={seasonLine} />
          </div>
        )}
      </header>
      {series.length === 0 ? (
        <p className={styles.empty}>No game logs for this player yet.</p>
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
