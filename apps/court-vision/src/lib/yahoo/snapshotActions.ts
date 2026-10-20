"use server";

import { isActionId } from "@vision/core/util/argGuards";
import { isBridgeLeaguePayload } from "@vision/yahoo-bridge/protocol";

import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
import { MAX_SNAPSHOT_BYTES } from "@/lib/yahoo/constants";
import {
  importLoadedLeague,
  type LoadedLeague,
  loadFailureToResult,
  readStoredSync,
  syncLoadedLeague,
  toYahooPreview,
} from "@/lib/yahoo/importLeague";
import { parseYahooPayload } from "@/lib/yahoo/load";
import { yahooGameSchema } from "@/lib/yahoo/schemas";
import { measureSnapshotBytes } from "@/lib/yahoo/snapshotSize";
import {
  type YahooFailure,
  type YahooImportResult,
  type YahooPreviewResult,
  type YahooSyncResult,
} from "@/lib/yahoo/types";

// The extension path: the browser extension read Yahoo in the user's own
// session and hands the raw bodies over. Everything here is client-supplied,
// so it is size-capped and fully validated, and its player matches are never
// written to the shared `PlayerExternalId` table (`writeMappings: false`).

const INVALID_PAYLOAD: YahooFailure = { status: "invalid_payload" };

// Shape, then size, then the game body, then the league itself. The size check
// runs before any zod parse, and the current season comes from the game body
// the extension fetched, so this path never reads Yahoo from the server.
const loadSnapshot = ({ payload }: { payload: unknown }): LoadedLeague | YahooFailure => {
  if (!isBridgeLeaguePayload(payload)) return INVALID_PAYLOAD;
  if (measureSnapshotBytes({ payload, limit: MAX_SNAPSHOT_BYTES }).status === "over") {
    return INVALID_PAYLOAD;
  }
  const game = yahooGameSchema.safeParse(payload.game);
  if (!game.success) return INVALID_PAYLOAD;
  const loaded = parseYahooPayload({
    currentSeason: game.data.fantasy_content.game.season,
    snapshot: payload.snapshot,
    waiverPages: payload.waiverPages,
  });
  return loaded.status === "ok" ? loaded : loadFailureToResult({ failure: loaded });
};

export const previewYahooSnapshot = async ({
  payload,
}: {
  payload: unknown;
}): Promise<YahooPreviewResult> =>
  withProfile<YahooPreviewResult>({
    getProfile,
    run: async () => {
      const loaded = loadSnapshot({ payload });
      if (loaded.status !== "ok") return loaded;
      return { status: "ok", preview: toYahooPreview({ league: loaded.league }) };
    },
  });

export const importYahooLeagueFromSnapshot = async ({
  payload,
  myTeamExternalKey,
}: {
  payload: unknown;
  myTeamExternalKey: string;
}): Promise<YahooImportResult> => {
  if (!isActionId(myTeamExternalKey)) return { status: "invalid_team" };
  return withProfile<YahooImportResult>({
    getProfile,
    run: async ({ profile }) => {
      const loaded = loadSnapshot({ payload });
      if (loaded.status !== "ok") return loaded;
      return importLoadedLeague({
        profileId: profile.id,
        loaded,
        myTeamExternalKey,
        writeMappings: false,
        syncVia: "extension",
      });
    },
  });
};

export const syncYahooLeagueFromSnapshot = async ({
  leagueId,
  payload,
}: {
  leagueId: string;
  payload: unknown;
}): Promise<YahooSyncResult> => {
  if (!isActionId(leagueId)) return { status: "error" };
  return withProfile<YahooSyncResult>({
    getProfile,
    run: async ({ profile }) => {
      const stored = await readStoredSync({ profileId: profile.id, leagueId });
      if (stored.status !== "ok") return stored;
      // Any Yahoo import may sync from a snapshot, a server league included;
      // its `syncVia` is left as it is.
      if (stored.league.throttled) return { status: "throttled" };

      const loaded = loadSnapshot({ payload });
      if (loaded.status !== "ok") return loaded;
      return syncLoadedLeague({
        profileId: profile.id,
        leagueId,
        loaded,
        writeMappings: false,
        storedExternalKey: stored.league.externalKey,
      });
    },
  });
};
