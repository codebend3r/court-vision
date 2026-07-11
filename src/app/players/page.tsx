import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { searchPlayers } from "@/lib/players/search";
import { parsePlayersSearchParams } from "@/lib/players/searchParams";

import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = parsePlayersSearchParams({
    q: firstValue(raw.q),
    page: firstValue(raw.page),
    size: firstValue(raw.size),
    retired: firstValue(raw.retired),
  });
  const { rows, total, page } = await searchPlayers(params);
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);

  return (
    <main className={styles.page}>
      <h1>Players</h1>
      <PlayersSearchControls
        q={params.q}
        page={page}
        size={params.size}
        includeRetired={params.includeRetired}
        totalPages={totalPages}
      />
      <p className={styles.summary}>
        {total === 0
          ? params.q === ""
            ? "No players yet — the season data hasn't been synced."
            : `No players match "${params.q}".`
          : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
      </p>
      {total > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className={styles.nameCell}>
                    <PlayerAvatar fullName={row.fullName} nbaPersonId={row.nbaPersonId} size="sm" />
                    <Link href={`/players/${row.id}`}>{row.fullName}</Link>
                  </span>
                </td>
                <td>{row.teamAbbr ?? "—"}</td>
                <td>{row.position ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
