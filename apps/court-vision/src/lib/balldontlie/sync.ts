import { SyncSummary, replaceAdvancedGameLogs, replaceGameLogs } from "@/lib/stats/persist";
import { BACKFILL_SEASON_YEARS, SEASON_START_YEAR } from "@/lib/stats/season";

import { BdlClientDeps, fetchAllAdvancedStats, fetchAllStats } from "@/lib/balldontlie/endpoints";
import { fetchTeamAbbrById, writeBoxScores } from "@/lib/balldontlie/pipeline";
import { Logger, consoleLogger, silentLogger } from "@vision/core/util/logger";
import { isMainModule } from "@vision/core/util/runtime";
import { sequentially } from "@vision/core/util/sequentially";

const emptySummary: SyncSummary = { players: 0, seasonStats: 0, gameLogs: 0, advancedGameLogs: 0 };

const addSummaries = (totals: SyncSummary, summary: SyncSummary): SyncSummary => ({
  players: totals.players + summary.players,
  seasonStats: totals.seasonStats + summary.seasonStats,
  gameLogs: totals.gameLogs + summary.gameLogs,
  advancedGameLogs: totals.advancedGameLogs + summary.advancedGameLogs,
});

type SyncSeasonProps = {
  season: number;
  teamAbbrById: Map<number, string>;
  deps: BdlClientDeps;
  logger: Logger;
};

const syncSeason = async ({
  season,
  teamAbbrById,
  deps,
  logger,
}: SyncSeasonProps): Promise<SyncSummary> => {
  // Every line carries the season, so a multi-season backfill log reads in order.
  const seasonLogger: Logger = (message) => logger(`[${season}] ${message}`);
  const seasonDeps: BdlClientDeps = { ...deps, logger: seasonLogger };

  const [stats, advanced] = await Promise.all([
    fetchAllStats({ deps: seasonDeps, season }),
    fetchAllAdvancedStats({ deps: seasonDeps, season }),
  ]);
  seasonLogger(`Fetched ${stats.length} stat rows and ${advanced.length} advanced rows.`);

  // The season sync owns whole seasons: it replaces them, and their season
  // lines are summed from exactly the logs it just fetched.
  return writeBoxScores({
    stats,
    advanced,
    teamAbbrById,
    logger: seasonLogger,
    writers: {
      gameLogs: replaceGameLogs,
      advancedGameLogs: replaceAdvancedGameLogs,
      seasonLogs: async ({ gameLogs }) => gameLogs,
    },
  });
};

type SyncBalldontlieProps = { deps?: BdlClientDeps; seasons?: readonly number[]; logger?: Logger };

export async function syncBalldontlie(args: SyncBalldontlieProps = {}): Promise<SyncSummary> {
  const { deps = {}, seasons = [SEASON_START_YEAR] } = args;
  const logger = args.logger ?? deps.logger ?? silentLogger;

  const teamAbbrById = await fetchTeamAbbrById({ deps });
  logger(`Fetched ${teamAbbrById.size} teams.`);

  // Seasons run sequentially (oldest first) so player rows finish reflecting
  // the most recent team/position and API throttling stays predictable.
  const summaries = await sequentially({
    items: seasons,
    run: ({ item: season }) => syncSeason({ season, teamAbbrById, deps, logger }),
  });
  return summaries.reduce(addSummaries, emptySummary);
}

// CLI: season start years as args (`… sync.ts 2020 2021`), `--all` for the
// full backfill window (2016-17 → current), or no args for the current season.
const seasonsFromArgv = (argv: string[]): readonly number[] => {
  if (argv.includes("--all")) {
    return BACKFILL_SEASON_YEARS;
  }
  const years = argv.filter((arg) => /^\d{4}$/.test(arg)).map(Number);
  return years.length > 0 ? years : [SEASON_START_YEAR];
};

if (isMainModule({ moduleUrl: import.meta.url })) {
  syncBalldontlie({ seasons: seasonsFromArgv(process.argv.slice(2)), logger: consoleLogger })
    .then((summary) => {
      consoleLogger(
        `Balldontlie sync complete: ${summary.players} players, ${summary.seasonStats} season rows, ${summary.gameLogs} game logs, ${summary.advancedGameLogs} advanced game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Balldontlie sync failed:", error);
      process.exit(1);
    });
}
