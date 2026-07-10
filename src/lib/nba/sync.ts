import { SyncSummary, upsertGameLogs, upsertPlayers, upsertSeasonStats } from "@/lib/stats/persist";

import { REGULAR_SEASON_DATE_RANGES } from "./constants";
import {
  NbaClientDeps,
  fetchPlayerGameLogs,
  fetchPlayerIndex,
  fetchSeasonStats,
} from "./endpoints";
import { toGameLogInput, toPlayerInput, toSeasonStatsInput } from "./transform";

// Bun sets `import.meta.main` on the entry module. @types/node's ImportMeta
// doesn't declare it, so augment the global interface (declaration merging,
// same pattern as src/lib/prisma.ts) rather than adding bun-types or casting.
declare global {
  interface ImportMeta {
    readonly main: boolean;
  }
}

export async function syncNba(deps: NbaClientDeps = {}): Promise<SyncSummary> {
  const playerRows = await fetchPlayerIndex(deps);
  const players = await upsertPlayers(playerRows.map(toPlayerInput));

  const seasonRows = await fetchSeasonStats(deps);
  const seasonStats = await upsertSeasonStats(seasonRows.map(toSeasonStatsInput));

  const gameLogs = await REGULAR_SEASON_DATE_RANGES.reduce(async (previous, range) => {
    const runningTotal = await previous;
    const rows = await fetchPlayerGameLogs({ ...range, ...deps });
    const written = await upsertGameLogs(rows.map(toGameLogInput));
    return runningTotal + written;
  }, Promise.resolve(0));

  return { players, seasonStats, gameLogs };
}

if (import.meta.main) {
  syncNba()
    .then((summary) => {
      console.log(
        `NBA sync complete: ${summary.players} players, ${summary.seasonStats} season rows, ${summary.gameLogs} game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("NBA sync failed:", error);
      process.exit(1);
    });
}
