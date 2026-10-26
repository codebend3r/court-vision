import {
  SyncSummary,
  findSeasonAggregateLogs,
  replaceAdvancedGameLogsForGames,
  replaceGameLogsForGames,
} from "@/lib/stats/persist";
import { SEASON_TYPE } from "@/lib/stats/season";

import {
  MAX_NIGHTLY_DATES,
  datesBetween,
  isIsoDate,
  yesterdayInNewYork,
} from "@/lib/balldontlie/dates";
import { BdlClientDeps, fetchAllAdvancedStats, fetchAllStats } from "@/lib/balldontlie/endpoints";
import { fetchTeamAbbrById, writeBoxScores } from "@/lib/balldontlie/pipeline";
import { Logger, consoleLogger, silentLogger } from "@vision/core/util/logger";
import { isMainModule } from "@vision/core/util/runtime";

export type NightlySyncSummary = SyncSummary & { games: number };

const emptySummary: NightlySyncSummary = {
  games: 0,
  players: 0,
  gameLogs: 0,
  advancedGameLogs: 0,
  seasonStats: 0,
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

// Pulls only the box scores for the given game dates and folds them in: the
// players who appeared, their game logs and advanced logs for those games, and
// their season lines, which are rebuilt from every stored log so they stay
// exact. Team stats need no write of their own; the teams page sums them from
// the game logs. Everyone who did not play keeps their rows untouched; the
// full season sync (`sync:bdl`) remains the manual way to rebuild everything.
type SyncNightlyProps = {
  dates: string[];
  deps?: BdlClientDeps;
  logger?: Logger;
};

export async function syncNightly(args: SyncNightlyProps): Promise<NightlySyncSummary> {
  const { dates, deps = {} } = args;
  const logger = args.logger ?? deps.logger ?? silentLogger;
  const nightDeps: BdlClientDeps = { ...deps, logger };
  const label = dates.join(", ");

  // An empty night (an off day, or playoffs only) ends here, before any other
  // request or write.
  const stats = await fetchAllStats({ deps: nightDeps, dates });
  if (stats.length === 0) {
    logger(`No regular-season box scores for ${label}; nothing to sync.`);
    return emptySummary;
  }
  const games = unique(stats.map((stat) => stat.game.id)).length;
  logger(`Fetched ${stats.length} stat rows across ${games} games for ${label}.`);

  const [teamAbbrById, advanced] = await Promise.all([
    fetchTeamAbbrById({ deps }),
    fetchAllAdvancedStats({ deps: nightDeps, dates }),
  ]);
  logger(`Fetched ${advanced.length} advanced rows.`);

  // The nightly sync owns whole games: it replaces those, and rebuilds each
  // appearing player's season line from every log stored for them.
  const summary = await writeBoxScores({
    stats,
    advanced,
    teamAbbrById,
    logger,
    writers: {
      gameLogs: replaceGameLogsForGames,
      advancedGameLogs: replaceAdvancedGameLogsForGames,
      seasonLogs: ({ gameLogs }) =>
        findSeasonAggregateLogs({
          playerIds: unique(gameLogs.map((log) => log.playerId)),
          seasons: unique(gameLogs.map((log) => log.season)),
          seasonType: SEASON_TYPE,
        }),
    },
  });

  return { games, ...summary };
}

const FLAGS = ["--date", "--from", "--to"];

type FlagValuesProps = { argv: string[]; flag: string };

const flagValues = ({ argv, flag }: FlagValuesProps): string[] =>
  argv.flatMap((arg, index) => (arg === flag ? [argv[index + 1] ?? ""] : []));

// CLI: no args syncs last night (yesterday in New York). `--date YYYY-MM-DD`
// (repeatable) names nights directly; `--from YYYY-MM-DD [--to YYYY-MM-DD]`
// catches up a range, and `--to` defaults to last night.
type DatesFromArgvProps = { argv: string[]; now: Date };

export const datesFromArgv = ({ argv, now }: DatesFromArgvProps): string[] => {
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
