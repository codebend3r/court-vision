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
import { isMainModule } from "@/lib/runtime";

export async function seedDemo(deps: BdlClientDeps = {}): Promise<SyncSummary> {
  const teams = await fetchTeams(deps);
  console.log(`Fetched ${teams.length} teams.`);
  const teamAbbrById = teams.reduce(
    (map, team) => map.set(team.id, team.abbreviation),
    new Map<number, string>(),
  );

  const bdlPlayers = await fetchAllPlayers({ deps, throttleMs: FREE_TIER_THROTTLE_MS });
  const players = await upsertPlayers(bdlPlayers.map((player) => toPlayerInput({ player })));
  console.log(`Fetched ${bdlPlayers.length} players, upserted ${players}.`);

  const byName = bdlPlayers.reduce(
    (map, player) => map.set(normalizeName(`${player.first_name} ${player.last_name}`), player),
    new Map<string, BdlPlayer>(),
  );

  const gameLogInputs = await DEMO_PROFILES.reduce(async (previous, profile) => {
    const acc = await previous;
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
    console.log(`${profile.fullName}: generated ${logs.length} game logs.`);
    return acc.concat(logs);
  }, Promise.resolve<GameLogInput[]>([]));

  const gameLogs = await upsertGameLogs(gameLogInputs);
  const seasonStats = await upsertSeasonStats(aggregateSeasonStats(gameLogInputs));
  return { players, seasonStats, gameLogs };
}

if (isMainModule({ moduleUrl: import.meta.url })) {
  seedDemo()
    .then((summary) => {
      console.log(
        `Demo seed complete: ${summary.players} players, ${summary.seasonStats} season rows, ${summary.gameLogs} game logs.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Demo seed failed:", error);
      process.exit(1);
    });
}
