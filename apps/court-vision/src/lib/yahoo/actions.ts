"use server";

import { isActionId, isActionText } from "@vision/core/util/argGuards";

import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
import { prisma } from "@/lib/prisma";
import { YAHOO_PROVIDER } from "@/lib/yahoo/constants";
import {
  importLoadedLeague,
  loadLeagueFromUrl,
  readStoredSync,
  recordLoadFailure,
  syncLoadedLeague,
  toYahooPreview,
} from "@/lib/yahoo/importLeague";
import { loadYahooLeague } from "@/lib/yahoo/load";
import { claimSync, releaseSync } from "@/lib/yahoo/syncLease";
import {
  type SetMyTeamResult,
  type YahooImportResult,
  type YahooPreviewResult,
  type YahooSyncResult,
} from "@/lib/yahoo/types";

// The server path: Court Vision reads Yahoo itself, so player matches may be
// stored for every user's imports. The shared steps live in `importLeague.ts`.

type PreviewYahooLeagueProps = { url: string };

export const previewYahooLeague = async ({
  url,
}: PreviewYahooLeagueProps): Promise<YahooPreviewResult> => {
  if (!isActionText(url)) return { status: "invalid_url" };
  return withProfile<YahooPreviewResult>({
    getProfile,
    run: async () => {
      const loaded = await loadLeagueFromUrl({ url, includeWaivers: false });
      if (loaded.status !== "ok") return loaded;
      return { status: "ok", preview: toYahooPreview({ league: loaded.league }) };
    },
  });
};

type ImportYahooLeagueProps = {
  url: string;
  myTeamExternalKey: string;
};

export const importYahooLeague = async ({
  url,
  myTeamExternalKey,
}: ImportYahooLeagueProps): Promise<YahooImportResult> => {
  if (!isActionText(url)) return { status: "invalid_url" };
  if (!isActionId(myTeamExternalKey)) return { status: "invalid_team" };
  return withProfile<YahooImportResult>({
    getProfile,
    run: async ({ profile }) => {
      const loaded = await loadLeagueFromUrl({ url, includeWaivers: true });
      if (loaded.status !== "ok") return loaded;
      return importLoadedLeague({
        profileId: profile.id,
        loaded,
        myTeamExternalKey,
        writeMappings: true,
        syncVia: "server",
      });
    },
  });
};

type SyncYahooLeagueProps = {
  leagueId: string;
};

export const syncYahooLeague = async ({
  leagueId,
}: SyncYahooLeagueProps): Promise<YahooSyncResult> => {
  if (!isActionId(leagueId)) return { status: "error" };
  return withProfile<YahooSyncResult>({
    getProfile,
    run: async ({ profile }) => {
      const stored = await readStoredSync({ profileId: profile.id, leagueId });
      if (stored.status !== "ok") return stored;
      // Only a server league is read from here. Tests the raw column, so an
      // unknown stored value fails closed; stand down before the throttle and
      // before any load, and record nothing on the league.
      if (stored.league.syncVia !== "server") return { status: "needs_extension" };
      if (stored.league.throttled) return { status: "throttled" };

      const syncStartedAt = await claimSync({ profileId: profile.id, leagueId });
      if (syncStartedAt === null) return { status: "throttled" };
      try {
        const loaded = await loadYahooLeague({ leagueId: stored.league.yahooLeagueId });
        if (loaded.status !== "ok") {
          return await recordLoadFailure({
            profileId: profile.id,
            leagueId,
            failure: loaded,
            syncStartedAt,
          });
        }
        return await syncLoadedLeague({
          profileId: profile.id,
          leagueId,
          loaded,
          writeMappings: true,
          storedExternalKey: stored.league.externalKey,
          syncStartedAt,
        });
      } finally {
        await releaseSync({ profileId: profile.id, leagueId, syncStartedAt });
      }
    },
  });
};

type SetMyTeamProps = {
  leagueId: string;
  teamId: string;
};

export const setMyTeam = async ({ leagueId, teamId }: SetMyTeamProps): Promise<SetMyTeamResult> => {
  if (!isActionId(leagueId) || !isActionId(teamId)) return { status: "invalid" };
  return withProfile<SetMyTeamResult>({
    getProfile,
    run: async ({ profile }) => {
      // One read proves the team is in that league, and the league is the
      // caller's own import: a hand-built league has no "my team".
      const team = await prisma.leagueTeam.findFirst({
        where: {
          id: teamId,
          leagueId,
          league: { profileId: profile.id, provider: YAHOO_PROVIDER },
        },
        select: { id: true },
      });
      if (team === null) return { status: "invalid" };
      await prisma.league.update({
        where: { id: leagueId, profileId: profile.id },
        data: { myTeamId: team.id },
      });
      return { status: "ok" };
    },
  });
};
