import { FREE_TIER_THROTTLE_MS } from "@/lib/balldontlie/constants";
import {
  BdlClientDeps,
  fetchAllPlayers,
  fetchTeamGames,
  fetchTeams,
} from "@/lib/balldontlie/endpoints";
import { BdlPlayer } from "@/lib/balldontlie/schemas";
import { aggregateSeasonStats, toPlayerInput } from "@/lib/balldontlie/transform";
import { GameLogInput } from "@/lib/stats/inputs";
import { SyncSummary, upsertGameLogs, upsertPlayers, upsertSeasonStats } from "@/lib/stats/persist";

import { generateGameLogs } from "@/lib/demo/generate";
import { normalizeName } from "@/lib/demo/names";
import { DEMO_PROFILES } from "@/lib/demo/profiles";
import { Logger, consoleLogger, silentLogger } from "@/lib/logger";
import { sequentially } from "@/lib/sequentially";
import { isMainModule } from "@/lib/runtime";

export async function seedDemo(
  args: { deps?: BdlClientDeps; logger?: Logger } = {},
): Promise<SyncSummary> {
  const { deps = {}, logger = silentLogger } = args;

  const teams = await fetchTeams(deps);
  logger(`Fetched ${teams.length} teams.`);
  const teamAbbrById = teams.reduce(
    (map, team) => map.set(team.id, team.abbreviation),
    new Map<number, string>(),
  );

  const bdlPlayers = await fetchAllPlayers({ deps, throttleMs: FREE_TIER_THROTTLE_MS });
  const players = await upsertPlayers(bdlPlayers.map((player) => toPlayerInput({ player })));
  logger(`Fetched ${bdlPlayers.length} players, upserted ${players}.`);

  const byName = bdlPlayers.reduce(
    (map, player) => map.set(normalizeName(`${player.first_name} ${player.last_name}`), player),
    new Map<string, BdlPlayer>(),
  );

  // One profile at a time: fetchTeamGames is throttled to the free API tier,
  // so overlapping these would just queue against the same rate limit.
  const gameLogInputs = (
    await sequentially({
      items: DEMO_PROFILES,
      run: async ({ item: profile }): Promise<GameLogInput[]> => {
        const match = byName.get(normalizeName(profile.fullName));
        const team = match?.team ?? null;
        if (!match || team === null) {
          throw new Error(`Demo profile not resolvable: ${profile.fullName}`);
        }
        const games = await fetchTeamGames({
          teamId: team.id,
          deps,
          throttleMs: FREE_TIER_THROTTLE_MS,
        });
        const logs = generateGameLogs({
          playerId: match.id,
          teamId: team.id,
          teamAbbr: team.abbreviation,
          games,
          profile,
          teamAbbrById,
        });
        logger(`${profile.fullName}: generated ${logs.length} game logs.`);
        return logs;
      },
    })
  ).flat();

  const gameLogs = await upsertGameLogs(gameLogInputs);
  const seasonStats = await upsertSeasonStats(aggregateSeasonStats(gameLogInputs));
  // The demo seed generates box scores only; advanced metrics come from the
  // Balldontlie sync.
  return { players, seasonStats, gameLogs, advancedGameLogs: 0 };
}

if (isMainModule({ moduleUrl: import.meta.url })) {
  seedDemo({ logger: consoleLogger })
    .then((summary) => {
      consoleLogger(
        `Demo seed complete: ${summary.players} players, ${summary.seasonStats} season rows, ${summary.gameLogs} game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Demo seed failed:", error);
      process.exit(1);
    });
}
