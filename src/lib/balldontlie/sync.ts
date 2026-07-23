import { BACKFILL_SEASON_YEARS, SEASON_YEAR } from "@/lib/balldontlie/constants";
import {
  type BdlClientDeps,
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
import { isMainModule } from "@/lib/runtime";
import {
  type SyncSummary,
  upsertAdvancedGameLogs,
  upsertGameLogs,
  upsertPlayers,
  upsertSeasonStats,
} from "@/lib/stats/persist";

const emptySummary: SyncSummary = { players: 0, seasonStats: 0, gameLogs: 0, advancedGameLogs: 0 };

const logPage =
  (label: string) =>
  ({
    page,
    totalRows,
    nextCursor,
  }: {
    page: number;
    totalRows: number;
    nextCursor: number | null;
  }) => {
    console.log(
      `${label} page ${page}: ${totalRows} rows total${nextCursor === null ? " (final page)" : ""}`,
    );
  };

const syncSeason = async (args: {
  season: string;
  teamAbbrById: Map<number, string>;
  deps: BdlClientDeps;
}): Promise<SyncSummary> => {
  const { season, teamAbbrById, deps } = args;

  const stats = await fetchAllStats({
    deps: { onPage: logPage(`[${season}] stats`), ...deps },
    season,
  });
  console.log(`[${season}] fetched ${stats.length} stat rows; upserting players…`);

  const players = await upsertPlayers(toPlayerInputs(stats, teamAbbrById));
  console.log(`[${season}] upserted ${players} players; upserting game logs…`);

  const gameLogInputs = stats.map((stat) => toGameLogInput({ stat, teamAbbrById }));
  const gameLogs = await upsertGameLogs(gameLogInputs);
  console.log(`[${season}] upserted ${gameLogs} game logs; aggregating season stats…`);

  const seasonStats = await upsertSeasonStats(aggregateSeasonStats(gameLogInputs));
  console.log(`[${season}] upserted ${seasonStats} season rows; fetching advanced stats…`);

  const advanced = await fetchAllAdvancedStats({
    deps: { onPage: logPage(`[${season}] advanced`), ...deps },
    season,
  });
  const advancedGameLogs = await upsertAdvancedGameLogs(
    advanced.map((stat) => toAdvancedGameLogInput({ stat })),
  );
  console.log(`[${season}] upserted ${advancedGameLogs} advanced game logs.`);

  return { players, seasonStats, gameLogs, advancedGameLogs };
};

export async function syncBalldontlie(
  args: { deps?: BdlClientDeps; seasons?: string[] } = {},
): Promise<SyncSummary> {
  const { deps = {}, seasons = [SEASON_YEAR] } = args;

  const teams = await fetchTeams(deps);
  console.log(`Fetched ${teams.length} teams.`);
  const teamAbbrById = teams.reduce(
    (map, team) => map.set(team.id, team.abbreviation),
    new Map<number, string>(),
  );

  // Seasons run sequentially (oldest first) so player rows finish reflecting
  // the most recent team/position and API throttling stays predictable.
  return seasons.reduce(async (previous, season) => {
    const totals = await previous;
    const seasonSummary = await syncSeason({ season, teamAbbrById, deps });
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
  syncBalldontlie({ seasons: seasonsFromArgv(process.argv.slice(2)) })
    .then((summary) => {
      console.log(
        `Balldontlie sync complete: ${summary.players} players, ${summary.seasonStats} season rows, ${summary.gameLogs} game logs, ${summary.advancedGameLogs} advanced game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Balldontlie sync failed:", error);
      process.exit(1);
    });
}
