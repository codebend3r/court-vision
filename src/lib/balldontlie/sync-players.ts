import { FREE_TIER_THROTTLE_MS } from "@/lib/balldontlie/constants";
import { type BdlClientDeps, fetchAllPlayers } from "@/lib/balldontlie/endpoints";
import { toPlayerInput } from "@/lib/balldontlie/transform";
import { isMainModule } from "@/lib/runtime";
import { upsertPlayers } from "@/lib/stats/persist";

export type PlayerSyncSummary = {
  fetched: number;
  upserted: number;
};

export async function syncPlayers(deps: BdlClientDeps = {}): Promise<PlayerSyncSummary> {
  const players = await fetchAllPlayers({
    deps: {
      ...deps,
      onPage: (progress) => {
        deps.onPage?.(progress);
        const { page, totalRows, nextCursor } = progress;
        console.log(
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
  syncPlayers()
    .then(({ fetched, upserted }) => {
      console.log(`Player metadata sync complete: ${fetched} fetched, ${upserted} upserted.`);
    })
    .catch((error: unknown) => {
      console.error("Player metadata sync failed:", error);
      process.exit(1);
    });
}
