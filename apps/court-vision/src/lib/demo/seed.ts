import { BdlClientDeps, fetchAllPlayers, fetchTeamGames } from "@/lib/balldontlie/endpoints";
import { fetchTeamAbbrById } from "@/lib/balldontlie/pipeline";
import { BdlPlayer } from "@/lib/balldontlie/schemas";
import { aggregateSeasonStats, toPlayerInput } from "@/lib/balldontlie/transform";
import { GameLogInput } from "@/lib/stats/inputs";
import {
  SyncSummary,
  markActiveRoster,
  replaceGameLogs,
  upsertPlayers,
  upsertSeasonStats,
} from "@/lib/stats/persist";

import { generateGameLogs } from "@/lib/demo/generate";
import { DEMO_PROFILES } from "@/lib/demo/profiles";
import { Logger, consoleLogger, silentLogger } from "@vision/core/util/logger";
import { normalizeName } from "@vision/core/util/names";
import { sequentially } from "@vision/core/util/sequentially";
import { isMainModule } from "@vision/core/util/runtime";

export async function seedDemo(
  args: { deps?: BdlClientDeps; logger?: Logger } = {},
): Promise<SyncSummary> {
  const { deps = {}, logger = silentLogger } = args;

  const teamAbbrById = await fetchTeamAbbrById({ deps });
  logger(`Fetched ${teamAbbrById.size} teams.`);

  const bdlPlayers = await fetchAllPlayers({ deps });
  const players = await upsertPlayers({
    players: bdlPlayers.map((player) => toPlayerInput({ player })),
  });
  logger(`Fetched ${bdlPlayers.length} players, upserted ${players}.`);

  const byName = bdlPlayers.reduce(
    (map, player) =>
      map.set(normalizeName({ name: `${player.first_name} ${player.last_name}` }), player),
    new Map<string, BdlPlayer>(),
  );

  // One profile at a time: every fetch shares one API rate limit, so
  // overlapping these would just queue against it.
  const gameLogInputs = (
    await sequentially({
      items: DEMO_PROFILES,
      run: async ({ item: profile }): Promise<GameLogInput[]> => {
        const match = byName.get(normalizeName({ name: profile.fullName }));
        const team = match?.team ?? null;
        if (!match || team === null) {
          throw new Error(`Demo profile not resolvable: ${profile.fullName}`);
        }
        const games = await fetchTeamGames({ teamId: team.id, deps });
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

  const gameLogs = await replaceGameLogs({ rows: gameLogInputs });
  const seasonStats = await upsertSeasonStats({
    rows: aggregateSeasonStats({ logs: gameLogInputs }),
  });
  // Team rosters list active players only, so the profiled players are the
  // demo's rosters.
  await markActiveRoster({
    playerIds: [...new Set(gameLogInputs.map((log) => log.playerId))],
  });
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
