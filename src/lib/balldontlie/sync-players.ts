import { FREE_TIER_THROTTLE_MS } from "@/lib/balldontlie/constants";
import { BdlClientDeps, fetchAllPlayers } from "@/lib/balldontlie/endpoints";
import { toPlayerInput } from "@/lib/balldontlie/transform";
import { Logger, consoleLogger, silentLogger } from "@/lib/logger";
import { isMainModule } from "@/lib/runtime";
import { upsertPlayers } from "@/lib/stats/persist";

export type PlayerSyncSummary = {
  fetched: number;
  upserted: number;
};

export async function syncPlayers(
  args: { deps?: BdlClientDeps; logger?: Logger } = {},
): Promise<PlayerSyncSummary> {
  const { deps = {}, logger = silentLogger } = args;

  const players = await fetchAllPlayers({
    deps: {
      ...deps,
      onPage: (progress) => {
        deps.onPage?.(progress);
        const { page, totalRows, nextCursor } = progress;
        logger(
          `players page ${page}: ${totalRows} rows total${nextCursor === null ? " (final page)" : ""}`,
        );
      },
    },
    throttleMs: FREE_TIER_THROTTLE_MS,
  });
  const upserted = await upsertPlayers(players.map((player) => toPlayerInput({ player })));
  return { fetched: players.length, upserted };
}

if (isMainModule({ moduleUrl: import.meta.url })) {
  syncPlayers({ logger: consoleLogger })
    .then(({ fetched, upserted }) => {
      consoleLogger(`Player metadata sync complete: ${fetched} fetched, ${upserted} upserted.`);
    })
    .catch((error: unknown) => {
      console.error("Player metadata sync failed:", error);
      process.exit(1);
    });
}
