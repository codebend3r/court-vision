"use server";

import { type Prisma } from "@generated/prisma/client";
import { MAX_LEAGUES } from "@vision/core/league/constants";
import { isActionId, isActionText } from "@vision/core/util/argGuards";

import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
import { formatLeagueMeta } from "@/lib/leagues/format";
import { toLeagueSummary } from "@/lib/leagues/queries";
import { prisma } from "@/lib/prisma";
import { hasPrismaCode, PRISMA_UNIQUE_VIOLATION } from "@/lib/prismaErrors";
import { YAHOO_PROVIDER, YAHOO_SYNC_THROTTLE_MS } from "@/lib/yahoo/constants";
import { loadYahooLeague, type YahooLoadFailure, type YahooLoadResult } from "@/lib/yahoo/load";
import { resolveYahooPlayers, type ResolvedPlayers } from "@/lib/yahoo/matchPlayers";
import {
  GENERIC_SYNC_ERROR_MESSAGE,
  KEY_CHANGED_MESSAGE,
  yahooFailureMessage,
} from "@/lib/yahoo/messages";
import { createImportedLeague, syncImportedLeague } from "@/lib/yahoo/persist";
import {
  type ImportedLeague,
  type SetMyTeamResult,
  type YahooFailure,
  type YahooImportResult,
  type YahooPlayerRef,
  type YahooPreview,
  type YahooPreviewResult,
  type YahooSyncResult,
} from "@/lib/yahoo/types";
import { parseYahooLeagueUrl } from "@/lib/yahoo/url";

type LoadedLeague = Extract<YahooLoadResult, { status: "ok" }>;
type LoadFailureStatus =
  | Exclude<YahooLoadFailure["status"], "unsupported">
  | "highscore"
  | "unsupported_scoring";
type LoadFailure = Extract<YahooFailure, { status: LoadFailureStatus }>;

// An import or sync writes each team in its own statement before the slots
// and waivers, so it gets more room than Prisma's 5 s interactive default.
const TRANSACTION_OPTIONS = { timeout: 30_000 };

// When the league last tried to sync, in ms. A success stamps `syncedAt`; a
// failure leaves `syncError` set and bumps `updatedAt` with that write, so a
// league Yahoo keeps failing on is throttled as well.
const lastSyncAttempt = ({
  league,
}: {
  league: { syncedAt: Date | null; syncError: string | null; updatedAt: Date };
}): number =>
  Math.max(
    league.syncedAt?.getTime() ?? 0,
    league.syncError === null ? 0 : league.updatedAt.getTime(),
  );

const toFailure = ({ failure }: { failure: YahooLoadFailure }): LoadFailure => {
  if (failure.status !== "unsupported") return failure;
  return failure.reason === "highscore"
    ? { status: "highscore" }
    : { status: "unsupported_scoring" };
};

// Reads the league a pasted URL names. Every action refetches from Yahoo
// rather than trusting anything the client was shown in a preview. A preview
// shows no waivers, so it skips paging them.
const loadFromUrl = async ({
  url,
  includeWaivers,
}: {
  url: string;
  includeWaivers: boolean;
}): Promise<LoadedLeague | YahooFailure> => {
  const parsed = parseYahooLeagueUrl({ input: url });
  if (parsed.status === "invalid") return { status: "invalid_url" };
  if (parsed.status !== "ok") return { status: parsed.status };
  const loaded = await loadYahooLeague({ leagueId: parsed.leagueId, includeWaivers });
  return loaded.status === "ok" ? loaded : toFailure({ failure: loaded });
};

// Every player Yahoo named: each team's roster, then the waiver list.
const playerRefs = ({ league, waiverRefs }: LoadedLeague): YahooPlayerRef[] => [
  ...league.teams.flatMap(({ slots }) => slots.flatMap(({ player }) => (player ? [player] : []))),
  ...waiverRefs,
];

// Server-fetched data, so the matches may be stored for every user's imports.
const resolvePlayers = ({ loaded }: { loaded: LoadedLeague }): Promise<ResolvedPlayers> =>
  resolveYahooPlayers({ refs: playerRefs(loaded), writeMappings: true });

const unmatchedNames = ({ resolved }: { resolved: ResolvedPlayers }): string[] =>
  resolved.unmatched.map(({ fullName }) => fullName);

const toPreview = ({ league }: { league: ImportedLeague }): YahooPreview => ({
  name: league.name,
  logoUrl: league.logoUrl,
  meta: formatLeagueMeta({
    league: {
      teamCount: league.teamCount,
      scoringType: league.scoring.scoringType,
      scoringConfig: league.scoring.scoringConfig,
    },
  }),
  unsupportedCategories: league.scoring.unsupportedCategories,
  teams: league.teams.map((team) => ({
    externalKey: team.externalKey,
    name: team.name,
    logoUrl: team.logoUrl,
    managerName: team.managerName,
    rosterCount: team.slots.filter(({ player }) => !!player).length,
    isOwnedByCurrentLogin: team.isOwnedByCurrentLogin,
  })),
});

export const previewYahooLeague = async ({ url }: { url: string }): Promise<YahooPreviewResult> => {
  if (!isActionText(url)) return { status: "invalid_url" };
  return withProfile<YahooPreviewResult>({
    getProfile,
    run: async () => {
      const loaded = await loadFromUrl({ url, includeWaivers: false });
      if (loaded.status !== "ok") return loaded;
      return { status: "ok", preview: toPreview({ league: loaded.league }) };
    },
  });
};

// The caller's existing import of this Yahoo league, if any.
const findImported = ({
  client,
  profileId,
  externalKey,
}: {
  client: Prisma.TransactionClient;
  profileId: string;
  externalKey: string;
}) =>
  client.league.findFirst({
    where: { profileId, provider: YAHOO_PROVIDER, externalKey },
    select: { slug: true },
  });

export const importYahooLeague = async ({
  url,
  myTeamExternalKey,
}: {
  url: string;
  myTeamExternalKey: string;
}): Promise<YahooImportResult> => {
  if (!isActionText(url)) return { status: "invalid_url" };
  if (!isActionId(myTeamExternalKey)) return { status: "invalid_team" };
  return withProfile<YahooImportResult>({
    getProfile,
    run: async ({ profile }) => {
      const loaded = await loadFromUrl({ url, includeWaivers: true });
      if (loaded.status !== "ok") return loaded;
      const { league, waiverRefs } = loaded;
      // Checked before matching, so a forged key writes nothing at all.
      if (!league.teams.some(({ externalKey }) => externalKey === myTeamExternalKey)) {
        return { status: "invalid_team" };
      }
      // An early answer for the common refusals, so they skip player matching
      // and its writes. Not authoritative: the transaction checks both again.
      const early = await findImported({
        client: prisma,
        profileId: profile.id,
        externalKey: league.externalKey,
      });
      if (early !== null) return { status: "duplicate", slug: early.slug };
      if ((await prisma.league.count({ where: { profileId: profile.id } })) >= MAX_LEAGUES) {
        return { status: "limit" };
      }
      const resolved = await resolvePlayers({ loaded });
      try {
        return await prisma.$transaction(async (tx): Promise<YahooImportResult> => {
          const existing = await findImported({
            client: tx,
            profileId: profile.id,
            externalKey: league.externalKey,
          });
          if (existing !== null) return { status: "duplicate", slug: existing.slug };
          const count = await tx.league.count({ where: { profileId: profile.id } });
          if (count >= MAX_LEAGUES) return { status: "limit" };
          const created = await createImportedLeague({
            tx,
            profileId: profile.id,
            league,
            resolved,
            waiverRefs,
            myTeamExternalKey,
          });
          return {
            status: "ok",
            league: toLeagueSummary({ league: created }),
            unmatched: unmatchedNames({ resolved }),
          };
        }, TRANSACTION_OPTIONS);
      } catch (error) {
        // A concurrent import of the same league won the unique constraint.
        if (!hasPrismaCode({ error, code: PRISMA_UNIQUE_VIOLATION })) throw error;
        const winner = await findImported({
          client: prisma,
          profileId: profile.id,
          externalKey: league.externalKey,
        });
        if (winner === null) throw error;
        return { status: "duplicate", slug: winner.slug };
      }
    },
  });
};

export const syncYahooLeague = async ({
  leagueId,
}: {
  leagueId: string;
}): Promise<YahooSyncResult> => {
  if (!isActionId(leagueId)) return { status: "error" };
  return withProfile<YahooSyncResult>({
    getProfile,
    run: async ({ profile }) => {
      const where = { id: leagueId, profileId: profile.id };
      const stored = await prisma.league.findFirst({
        where,
        select: {
          provider: true,
          externalKey: true,
          syncedAt: true,
          syncError: true,
          updatedAt: true,
        },
      });
      if (stored === null) return { status: "error" };
      // The key reads "478.l.106344"; the part after ".l." is Yahoo's league id.
      const yahooLeagueId = stored.externalKey?.split(".l.")[1] ?? "";
      if (stored.provider !== YAHOO_PROVIDER || !yahooLeagueId) return { status: "not_imported" };
      if (Date.now() - lastSyncAttempt({ league: stored }) < YAHOO_SYNC_THROTTLE_MS) {
        return { status: "throttled" };
      }

      // The league keeps its last good data on any failure; only the reason
      // is recorded, in the import page's copy, so the league page can say
      // why it is stale.
      const recordFailure = async ({ message }: { message: string }): Promise<void> => {
        await prisma.league.update({ where, data: { syncError: message } });
      };

      const loaded = await loadYahooLeague({ leagueId: yahooLeagueId });
      if (loaded.status !== "ok") {
        const failure = toFailure({ failure: loaded });
        await recordFailure({ message: yahooFailureMessage({ status: failure.status }) });
        return failure;
      }
      // Yahoo answers a reused league id with another season's league, whose
      // key the guarded update below would refuse; say why up front instead.
      if (loaded.league.externalKey !== stored.externalKey) {
        await recordFailure({ message: KEY_CHANGED_MESSAGE });
        return { status: "error" };
      }

      try {
        const resolved = await resolvePlayers({ loaded });
        const synced = await prisma.$transaction(
          (tx) =>
            syncImportedLeague({
              tx,
              profileId: profile.id,
              league: loaded.league,
              resolved,
              waiverRefs: loaded.waiverRefs,
              leagueId,
            }),
          TRANSACTION_OPTIONS,
        );
        return {
          status: "ok",
          syncedAt: synced.syncedAt?.toISOString() ?? new Date().toISOString(),
          unmatched: unmatchedNames({ resolved }),
        };
      } catch {
        // A write that failed after a good load (a timeout, or the guarded
        // update's P2025) rolls back, so the league still holds its old data.
        await recordFailure({ message: GENERIC_SYNC_ERROR_MESSAGE });
        return { status: "error" };
      }
    },
  });
};

export const setMyTeam = async ({
  leagueId,
  teamId,
}: {
  leagueId: string;
  teamId: string;
}): Promise<SetMyTeamResult> => {
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
