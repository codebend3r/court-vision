import { BdlClientDeps, fetchActivePlayers } from "@/lib/balldontlie/endpoints";
import { toPlayerInput } from "@/lib/balldontlie/transform";
import { Logger, consoleLogger, silentLogger } from "@vision/core/util/logger";
import { isMainModule } from "@vision/core/util/runtime";
import { markActiveRoster, upsertPlayers } from "@/lib/stats/persist";

export type PlayerSyncSummary = {
  fetched: number;
  upserted: number;
  active: number;
};

// Refreshes current NBA rosters from Balldontlie's active-player list: every
// player on it is upserted with their current team, position and jersey (so
// rookies and new signings get a row before they play), then flagged active,
// and everyone who dropped off the list is unflagged. A historical `sync:bdl`
// rewrites each player's team to their last synced season, so run this after
// it. Retired players keep the last team their game logs gave them.
export async function syncPlayers(
  args: { deps?: BdlClientDeps; logger?: Logger } = {},
): Promise<PlayerSyncSummary> {
  const { deps = {}, logger = silentLogger } = args;

  const players = await fetchActivePlayers({
    deps: {
      ...deps,
      onPage: (progress) => {
        deps.onPage?.(progress);
        const { page, totalRows, nextCursor } = progress;
        logger(
          `active players page ${page}: ${totalRows} rows total${nextCursor === null ? " (final page)" : ""}`,
        );
      },
    },
  });
  const upserted = await upsertPlayers(players.map((player) => toPlayerInput({ player })));
  const active = await markActiveRoster({ playerIds: players.map((player) => player.id) });
  return { fetched: players.length, upserted, active };
}

if (isMainModule({ moduleUrl: import.meta.url })) {
  syncPlayers({ logger: consoleLogger })
    .then(({ fetched, upserted, active }) => {
      consoleLogger(
        `Roster sync complete: ${fetched} fetched, ${upserted} upserted, ${active} on active rosters.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Roster sync failed:", error);
      process.exit(1);
    });
}
