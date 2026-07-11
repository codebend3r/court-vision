import { notFound } from "next/navigation";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { prisma } from "@/lib/prisma";
import { buildCumulativeSeries } from "@/lib/stats/cumulative";

import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

// Player.id is a Postgres INT4; anything outside its range would make Prisma
// throw (a 500) instead of rendering a 404.
const MAX_INT4 = 2147483647;

export default async function PlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
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
  const series = buildCumulativeSeries({ logs });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <PlayerAvatar fullName={player.fullName} nbaPersonId={player.nbaPersonId} size="lg" />
        <span className={styles.headerText}>
          <h1>{player.fullName}</h1>
          <p className={styles.meta}>
            {[player.teamAbbr, player.position].filter((part) => !!part).join(" · ")} — 2025-26 ·{" "}
            {series.length} games
          </p>
        </span>
      </header>
      {series.length === 0 ? (
        <p className={styles.empty}>No game logs for this player yet.</p>
      ) : (
        <PlayerStatChart series={series} />
      )}
    </main>
  );
}
