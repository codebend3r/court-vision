import { REGULAR_SEASON_DATE_RANGES } from "@/lib/nba/constants";
import { toGameLogInput, toPlayerInput, toSeasonStatsInput } from "@/lib/nba/transform";
import { isMainModule } from "@/lib/runtime";
import {
  type SyncSummary,
  upsertGameLogs,
  upsertPlayers,
  upsertSeasonStats,
} from "@/lib/stats/persist";
import {
  fetchPlayerGameLogs,
  fetchPlayerIndex,
  fetchSeasonStats,
  type NbaClientDeps,
} from "./endpoints";

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

  // The NBA.com sync predates advanced metrics; only the Balldontlie sync
  // writes them.
  return { players, seasonStats, gameLogs, advancedGameLogs: 0 };
}

if (isMainModule({ moduleUrl: import.meta.url })) {
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
