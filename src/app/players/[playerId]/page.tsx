import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayerGameLogTable } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { prisma } from "@/lib/prisma";
import { buildStatSeries } from "@/lib/stats/cumulative";
import { gamesForSpan, loadStatFilters } from "@/lib/stats/searchParams";

import styles from "@/app/players/[playerId]/page.module.scss";

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
  const logs = await prisma.playerGameLog.findMany({
    where: { playerId: numericId },
    orderBy: { gameDate: "asc" },
  });
  const { mode, span } = await loadStatFilters(searchParams ?? Promise.resolve({}));
  const windowSize = gamesForSpan({ span });
  const windowLogs = windowSize === null ? logs : logs.slice(-windowSize);
  const series = buildStatSeries({ logs: windowLogs, mode });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <PlayerAvatar fullName={player.fullName} nbaPersonId={player.nbaPersonId} size="lg" />
        <span className={styles.headerText}>
          <h1>{player.fullName}</h1>
          <p className={styles.meta}>
            {!!player.teamAbbr && <TeamChip team={player.teamAbbr} size="sm" />}
            {!!player.position && <span>{player.position}</span>}
            <span>2025-26 · {logs.length} games</span>
          </p>
        </span>
      </header>
      {series.length === 0 ? (
        <p className={styles.empty}>No game logs for this player yet.</p>
      ) : (
        <>
          <PlayerStatFilters />
          <PlayerStatChart series={series} mode={mode} />
          <PlayerGameLogTable
            rows={logs.map((log) => ({
              ...log,
              gameDate: log.gameDate.toISOString(),
            }))}
          />
        </>
      )}
    </main>
  );
}
