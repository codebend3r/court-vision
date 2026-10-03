import {
  SyncSummary,
  upsertAdvancedGameLogs,
  upsertGameLogs,
  upsertPlayers,
  upsertSeasonStats,
} from "@/lib/stats/persist";

import { BACKFILL_SEASON_YEARS, SEASON_YEAR } from "@/lib/balldontlie/constants";
import {
  BdlClientDeps,
  fetchAllAdvancedStats,
  fetchAllStats,
  fetchTeams,
} from "@/lib/balldontlie/endpoints";
import {
  aggregateSeasonStats,
  toAdvancedGameLogInput,
  toGameLogInput,
  toPlayerInputs,
} from "@/lib/balldontlie/transform";
import { Logger, consoleLogger, silentLogger } from "@/lib/logger";
import { isMainModule } from "@/lib/runtime";

const emptySummary: SyncSummary = { players: 0, seasonStats: 0, gameLogs: 0, advancedGameLogs: 0 };

const logPage =
  ({ label, logger }: { label: string; logger: Logger }) =>
  ({
    page,
    totalRows,
    nextCursor,
  }: {
    page: number;
    totalRows: number;
    nextCursor: number | null;
  }) => {
    logger(
      `${label} page ${page}: ${totalRows} rows total${nextCursor === null ? " (final page)" : ""}`,
    );
  };

const syncSeason = async (args: {
  season: string;
  teamAbbrById: Map<number, string>;
  deps: BdlClientDeps;
  logger: Logger;
}): Promise<SyncSummary> => {
  const { season, teamAbbrById, deps, logger } = args;

  const stats = await fetchAllStats({
    deps: { onPage: logPage({ label: `[${season}] stats`, logger }), ...deps },
    season,
  });
  logger(`[${season}] fetched ${stats.length} stat rows; upserting players…`);

  const players = await upsertPlayers(toPlayerInputs(stats, teamAbbrById));
  logger(`[${season}] upserted ${players} players; upserting game logs…`);

  const gameLogInputs = stats.map((stat) => toGameLogInput({ stat, teamAbbrById }));
  const gameLogs = await upsertGameLogs(gameLogInputs);
  logger(`[${season}] upserted ${gameLogs} game logs; aggregating season stats…`);

  const seasonStats = await upsertSeasonStats(aggregateSeasonStats(gameLogInputs));
  logger(`[${season}] upserted ${seasonStats} season rows; fetching advanced stats…`);

  const advanced = await fetchAllAdvancedStats({
    deps: { onPage: logPage({ label: `[${season}] advanced`, logger }), ...deps },
    season,
  });
  const advancedGameLogs = await upsertAdvancedGameLogs(
    advanced.map((stat) => toAdvancedGameLogInput({ stat })),
  );
  logger(`[${season}] upserted ${advancedGameLogs} advanced game logs.`);

  return { players, seasonStats, gameLogs, advancedGameLogs };
};

export async function syncBalldontlie(
  args: { deps?: BdlClientDeps; seasons?: string[]; logger?: Logger } = {},
): Promise<SyncSummary> {
  const { deps = {}, seasons = [SEASON_YEAR], logger = silentLogger } = args;

  const teams = await fetchTeams(deps);
  logger(`Fetched ${teams.length} teams.`);
  const teamAbbrById = teams.reduce(
    (map, team) => map.set(team.id, team.abbreviation),
    new Map<number, string>(),
  );

  // Seasons run sequentially (oldest first) so player rows finish reflecting
  // the most recent team/position and API throttling stays predictable.
  return seasons.reduce(async (previous, season) => {
    const totals = await previous;
    const seasonSummary = await syncSeason({ season, teamAbbrById, deps, logger });
    return {
      players: totals.players + seasonSummary.players,
      seasonStats: totals.seasonStats + seasonSummary.seasonStats,
      gameLogs: totals.gameLogs + seasonSummary.gameLogs,
      advancedGameLogs: totals.advancedGameLogs + seasonSummary.advancedGameLogs,
    };
  }, Promise.resolve(emptySummary));
}

// CLI: season start years as args (`… sync.ts 2020 2021`), `--all` for the
// full 2020→current backfill window, or no args for the current season.
const seasonsFromArgv = (argv: string[]): string[] => {
  if (argv.includes("--all")) {
    return BACKFILL_SEASON_YEARS;
  }
  const years = argv.filter((arg) => /^\d{4}$/.test(arg));
  return years.length > 0 ? years : [SEASON_YEAR];
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
