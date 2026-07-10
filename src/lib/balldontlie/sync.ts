import { SyncSummary, upsertGameLogs, upsertPlayers, upsertSeasonStats } from "@/lib/stats/persist";

import { BdlClientDeps, fetchAllStats, fetchTeams } from "./endpoints";
import { aggregateSeasonStats, toGameLogInput, toPlayerInputs } from "./transform";

// Bun sets `import.meta.main` on the entry module. @types/node's ImportMeta
// doesn't declare it, so augment the global interface (declaration merging,
// same pattern as src/lib/prisma.ts) rather than adding bun-types or casting.
declare global {
  interface ImportMeta {
    readonly main: boolean;
  }
}

export async function syncBalldontlie(deps: BdlClientDeps = {}): Promise<SyncSummary> {
  const teams = await fetchTeams(deps);
  console.log(`Fetched ${teams.length} teams.`);
  const teamAbbrById = teams.reduce(
    (map, team) => map.set(team.id, team.abbreviation),
    new Map<number, string>(),
  );

  const stats = await fetchAllStats({
    onPage: ({ page, totalRows, nextCursor }) => {
      console.log(
        `stats page ${page}: ${totalRows} rows total${nextCursor === null ? " (final page)" : ""}`,
      );
    },
    ...deps,
  });
  console.log(`Fetched ${stats.length} stat rows; upserting players…`);

  const players = await upsertPlayers(toPlayerInputs(stats, teamAbbrById));
  console.log(`Upserted ${players} players; upserting game logs…`);

  const gameLogInputs = stats.map((stat) => toGameLogInput({ stat, teamAbbrById }));
  const gameLogs = await upsertGameLogs(gameLogInputs);
  console.log(`Upserted ${gameLogs} game logs; aggregating season stats…`);

  const seasonStats = await upsertSeasonStats(aggregateSeasonStats(gameLogInputs));

  return { players, seasonStats, gameLogs };
}

if (import.meta.main) {
  syncBalldontlie()
    .then((summary) => {
      console.log(
        `Balldontlie sync complete: ${summary.players} players, ${summary.seasonStats} season rows, ${summary.gameLogs} game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Balldontlie sync failed:", error);
      process.exit(1);
    });
}
