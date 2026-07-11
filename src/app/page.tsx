import Link from "next/link";

import { Hello } from "@/components/Hello/Hello";
import { prisma } from "@/lib/prisma";

import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

export default async function Home() {
  const players = await prisma.player.findMany({
    where: { gameLogs: { some: {} } },
    orderBy: { fullName: "asc" },
  });

  return (
    <main className={styles.page}>
      <Hello name="world" />
      <section className={styles.players}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.title}>Players</h2>
          <Link href="/players" className={styles.allPlayers}>
            All players →
          </Link>
        </div>
        <ul className={styles.list}>
          {players.map((player) => (
            <li key={player.id}>
              <Link href={`/players/${player.id}`} className={styles.row}>
                <span>{player.fullName}</span>
                <span className={styles.team}>{player.teamAbbr ?? "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
