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
import { checkSnapshotShape } from "@/lib/yahoo/snapshotShape";
import { measureSnapshotBytes } from "@/lib/yahoo/snapshotSize";
import { claimSync, releaseSync } from "@/lib/yahoo/syncLease";
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

// Shape, then size, then counts, then the game body, then the league itself.
// The size and count checks run before any zod parse, and the current season
// comes from the game body the extension fetched, so this path never reads
// Yahoo from the server.
type LoadSnapshotProps = { payload: unknown };

const loadSnapshot = ({ payload }: LoadSnapshotProps): LoadedLeague | YahooFailure => {
  if (!isBridgeLeaguePayload(payload)) return INVALID_PAYLOAD;
  if (measureSnapshotBytes({ payload, limit: MAX_SNAPSHOT_BYTES }).status === "over") {
    return INVALID_PAYLOAD;
  }
  if (checkSnapshotShape({ payload }).status === "over") return INVALID_PAYLOAD;
  const game = yahooGameSchema.safeParse(payload.game);
  if (!game.success) return INVALID_PAYLOAD;
  const loaded = parseYahooPayload({
    currentSeason: game.data.fantasy_content.game.season,
    snapshot: payload.snapshot,
    waiverPages: payload.waiverPages,
    scoreboard: payload.scoreboard,
  });
  return loaded.status === "ok" ? loaded : loadFailureToResult({ failure: loaded });
};

type PreviewYahooSnapshotProps = {
  payload: unknown;
};

export const previewYahooSnapshot = async ({
  payload,
}: PreviewYahooSnapshotProps): Promise<YahooPreviewResult> =>
  withProfile<YahooPreviewResult>({
    getProfile,
    run: async () => {
      const loaded = loadSnapshot({ payload });
      if (loaded.status !== "ok") return loaded;
      return { status: "ok", preview: toYahooPreview({ league: loaded.league }) };
    },
  });

type ImportYahooLeagueFromSnapshotProps = {
  payload: unknown;
  myTeamExternalKey: string;
};

export const importYahooLeagueFromSnapshot = async ({
  payload,
  myTeamExternalKey,
}: ImportYahooLeagueFromSnapshotProps): Promise<YahooImportResult> => {
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

type SyncYahooLeagueFromSnapshotProps = {
  leagueId: string;
  payload: unknown;
};

export const syncYahooLeagueFromSnapshot = async ({
  leagueId,
  payload,
}: SyncYahooLeagueFromSnapshotProps): Promise<YahooSyncResult> => {
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
      const syncStartedAt = await claimSync({ profileId: profile.id, leagueId });
      if (syncStartedAt === null) return { status: "throttled" };
      try {
        return await syncLoadedLeague({
          profileId: profile.id,
          leagueId,
          loaded,
          writeMappings: false,
          storedExternalKey: stored.league.externalKey,
          syncStartedAt,
        });
      } finally {
        await releaseSync({ profileId: profile.id, leagueId, syncStartedAt });
      }
    },
  });
};
