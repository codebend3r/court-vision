import {
  findSeasonAggregateLogs,
  replaceAdvancedGameLogsForGames,
  replaceGameLogsForGames,
  upsertPlayers,
  upsertSeasonStats,
} from "@/lib/stats/persist";

import { SEASON_TYPE } from "@/lib/balldontlie/constants";
import {
  MAX_NIGHTLY_DATES,
  datesBetween,
  isIsoDate,
  yesterdayInNewYork,
} from "@/lib/balldontlie/dates";
import {
  BdlClientDeps,
  fetchAllAdvancedStats,
  fetchAllStats,
  fetchTeams,
} from "@/lib/balldontlie/endpoints";
import { logPage } from "@/lib/balldontlie/sync";
import {
  aggregateSeasonStats,
  toAdvancedGameLogInput,
  toGameLogInput,
  toPlayerInputs,
} from "@/lib/balldontlie/transform";
import { Logger, consoleLogger, silentLogger } from "@vision/core/util/logger";
import { isMainModule } from "@vision/core/util/runtime";

export type NightlySyncSummary = {
  games: number;
  players: number;
  gameLogs: number;
  advancedGameLogs: number;
  seasonStats: number;
};

const emptySummary: NightlySyncSummary = {
  games: 0,
  players: 0,
  gameLogs: 0,
  advancedGameLogs: 0,
  seasonStats: 0,
};

// The transform stamps every row "Regular Season", and these endpoints take
// no reliable postseason filter, so playoff rows are dropped here instead of
// being written into the regular-season tables.
const isRegularSeason = (row: { game: { postseason: boolean } }): boolean => !row.game.postseason;

const unique = <T>(values: T[]): T[] => [...new Set(values)];

// Pulls only the box scores for the given game dates and folds them in: the
// players who appeared, their game logs and advanced logs for those games, and
// their season lines, which are rebuilt from every stored log so they stay
// exact. Team stats need no write of their own; the teams page sums them from
// the game logs. Everyone who did not play keeps their rows untouched; the
// full season sync (`sync:bdl`) remains the manual way to rebuild everything.
export async function syncNightly(args: {
  dates: string[];
  deps?: BdlClientDeps;
  logger?: Logger;
}): Promise<NightlySyncSummary> {
  const { dates, deps = {}, logger = silentLogger } = args;
  const label = dates.join(", ");

  const stats = (
    await fetchAllStats({ deps: { onPage: logPage({ label: "stats", logger }), ...deps }, dates })
  ).filter(isRegularSeason);
  if (stats.length === 0) {
    logger(`No regular-season box scores for ${label}; nothing to sync.`);
    return emptySummary;
  }
  const games = unique(stats.map((stat) => stat.game.id)).length;
  logger(`Fetched ${stats.length} stat rows across ${games} games for ${label}.`);

  const teams = await fetchTeams(deps);
  const teamAbbrById = teams.reduce(
    (map, team) => map.set(team.id, team.abbreviation),
    new Map<number, string>(),
  );

  const players = await upsertPlayers(toPlayerInputs(stats, teamAbbrById));
  logger(`Upserted ${players} players; replacing game logs…`);

  const gameLogInputs = stats.map((stat) => toGameLogInput({ stat, teamAbbrById }));
  const gameLogs = await replaceGameLogsForGames(gameLogInputs);
  logger(`Replaced ${gameLogs} game logs; rebuilding season lines…`);

  const seasonLogs = await findSeasonAggregateLogs({
    playerIds: unique(gameLogInputs.map((log) => log.playerId)),
    seasons: unique(gameLogInputs.map((log) => log.season)),
    seasonType: SEASON_TYPE,
  });
  const seasonStats = await upsertSeasonStats(aggregateSeasonStats(seasonLogs));
  logger(`Rebuilt ${seasonStats} season lines; fetching advanced stats…`);

  const advanced = (
    await fetchAllAdvancedStats({
      deps: { onPage: logPage({ label: "advanced", logger }), ...deps },
      dates,
    })
  ).filter(isRegularSeason);
  const advancedGameLogs = await replaceAdvancedGameLogsForGames(
    advanced.map((stat) => toAdvancedGameLogInput({ stat })),
  );
  logger(`Replaced ${advancedGameLogs} advanced game logs.`);

  return { games, players, gameLogs, advancedGameLogs, seasonStats };
}

const FLAGS = ["--date", "--from", "--to"];

const flagValues = ({ argv, flag }: { argv: string[]; flag: string }): string[] =>
  argv.flatMap((arg, index) => (arg === flag ? [argv[index + 1] ?? ""] : []));

// CLI: no args syncs last night (yesterday in New York). `--date YYYY-MM-DD`
// (repeatable) names nights directly; `--from YYYY-MM-DD [--to YYYY-MM-DD]`
// catches up a range, and `--to` defaults to last night.
export const datesFromArgv = ({ argv, now }: { argv: string[]; now: Date }): string[] => {
  const unknown = argv.filter(
    (arg, index) => !FLAGS.includes(arg) && !FLAGS.includes(argv[index - 1] ?? ""),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(" ")}. Use --date, --from or --to.`);
  }
  const singles = flagValues({ argv, flag: "--date" });
  const [from] = flagValues({ argv, flag: "--from" });
  const [to] = flagValues({ argv, flag: "--to" });
  if (to !== undefined && from === undefined) {
    throw new Error("--to needs a --from.");
  }
  const requested = [...singles, ...[from, to].filter((value) => value !== undefined)];
  const invalid = requested.filter((value) => !isIsoDate(value));
  if (invalid.length > 0) {
    throw new Error(
      `Expected YYYY-MM-DD dates, got: ${invalid.map((value) => `"${value}"`).join(", ")}.`,
    );
  }
  const range =
    from === undefined ? [] : datesBetween({ from, to: to ?? yesterdayInNewYork({ now }) });
  const dates = unique([...singles, ...range]).sort();
  if (dates.length === 0) {
    return [yesterdayInNewYork({ now })];
  }
  if (dates.length > MAX_NIGHTLY_DATES) {
    throw new Error(
      `${dates.length} dates requested; the nightly sync takes at most ${MAX_NIGHTLY_DATES}. Use sync:bdl to rebuild a season.`,
    );
  }
  return dates;
};

if (isMainModule({ moduleUrl: import.meta.url })) {
  Promise.resolve()
    .then(() => datesFromArgv({ argv: process.argv.slice(2), now: new Date() }))
    .then((dates) => {
      consoleLogger(`Nightly sync for ${dates.join(", ")}`);
      return syncNightly({ dates, logger: consoleLogger });
    })
    .then((summary) => {
      consoleLogger(
        `Nightly sync complete: ${summary.games} games, ${summary.players} players, ${summary.gameLogs} game logs, ${summary.seasonStats} season lines, ${summary.advancedGameLogs} advanced game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Nightly sync failed:", error);
      process.exit(1);
    });
}
