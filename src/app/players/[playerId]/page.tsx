import { notFound } from "next/navigation";

import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { prisma } from "@/lib/prisma";
import { buildCumulativeSeries } from "@/lib/stats/cumulative";

import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const numericId = Number.parseInt(playerId, 10);
  if (Number.isNaN(numericId)) {
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
        <h1>{player.fullName}</h1>
        <p className={styles.meta}>
          {[player.teamAbbr, player.position].filter((part) => !!part).join(" · ")} — 2025-26 ·{" "}
          {series.length} games
        </p>
      </header>
      {series.length === 0 ? (
        <p className={styles.empty}>No game logs for this player yet.</p>
      ) : (
        <PlayerStatChart series={series} />
      )}
    </main>
  );
}
