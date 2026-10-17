// The steps every Yahoo import and sync shares, whichever path read the
// league: the server reading Yahoo itself (`actions.ts`), or the browser
// extension handing over a snapshot. Server-only: imported by server actions,
// never by a client module. Not a "use server" file, so it may export types
// and plain functions without each becoming a callable endpoint.

import { type Prisma } from "@generated/prisma/client";
import { MAX_LEAGUES } from "@vision/core/league/constants";

import { formatLeagueMeta } from "@/lib/leagues/format";
import { toLeagueSummary } from "@/lib/leagues/queries";
import { type LeagueSyncVia } from "@/lib/leagues/types";
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
  type YahooFailure,
  type YahooImportResult,
  type YahooPlayerRef,
  type YahooPreview,
  type YahooSyncResult,
} from "@/lib/yahoo/types";
import { parseYahooLeagueUrl } from "@/lib/yahoo/url";

export type LoadedLeague = Extract<YahooLoadResult, { status: "ok" }>;

type LoadFailureStatus =
  | Exclude<YahooLoadFailure["status"], "unsupported">
  | "highscore"
  | "unsupported_scoring";
type LoadFailureResult = Extract<YahooFailure, { status: LoadFailureStatus }>;

// What a sync needs to know about the stored league before it reads Yahoo.
// `syncVia` is the raw column, so a caller can refuse an unknown value.
export type StoredSync = {
  externalKey: string;
  yahooLeagueId: string;
  syncVia: string;
  throttled: boolean;
};

export type StoredSyncResult =
  | { status: "ok"; league: StoredSync }
  | { status: "not_imported" }
  | { status: "error" };

// An import or sync writes each team in its own statement before the slots
// and waivers, so it gets more room than Prisma's 5 s interactive default.
const TRANSACTION_OPTIONS = { timeout: 30_000 };

export const loadFailureToResult = ({
  failure,
}: {
  failure: YahooLoadFailure;
}): LoadFailureResult => {
  if (failure.status !== "unsupported") return failure;
  return failure.reason === "highscore"
    ? { status: "highscore" }
    : { status: "unsupported_scoring" };
};

// Reads the league a pasted URL names. Every action refetches from Yahoo
// rather than trusting anything the client was shown in a preview. A preview
// shows no waivers, so it skips paging them.
export const loadLeagueFromUrl = async ({
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
  return loaded.status === "ok" ? loaded : loadFailureToResult({ failure: loaded });
};

// Every player Yahoo named: each team's roster, then the waiver list.
const playerRefs = ({ league, waiverRefs }: LoadedLeague): YahooPlayerRef[] => [
  ...league.teams.flatMap(({ slots }) => slots.flatMap(({ player }) => (player ? [player] : []))),
  ...waiverRefs,
];

// `writeMappings` is true only for data the server fetched itself; matches
// from a client-supplied snapshot must never reach every user's imports.
const resolvePlayers = ({
  loaded,
  writeMappings,
}: {
  loaded: LoadedLeague;
  writeMappings: boolean;
}): Promise<ResolvedPlayers> => resolveYahooPlayers({ refs: playerRefs(loaded), writeMappings });

const unmatchedNames = ({ resolved }: { resolved: ResolvedPlayers }): string[] =>
  resolved.unmatched.map(({ fullName }) => fullName);

export const toYahooPreview = ({ league }: { league: ImportedLeague }): YahooPreview => ({
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

/**
 * Imports a league already read from Yahoo: refuses a team key outside it, a
 * duplicate and the league cap, then matches its players and writes it.
 */
export const importLoadedLeague = async ({
  profileId,
  loaded,
  myTeamExternalKey,
  writeMappings,
  syncVia,
}: {
  profileId: string;
  loaded: LoadedLeague;
  myTeamExternalKey: string;
  writeMappings: boolean;
  syncVia: LeagueSyncVia;
}): Promise<YahooImportResult> => {
  const { league, waiverRefs } = loaded;
  // Checked before matching, so a forged key writes nothing at all.
  if (!league.teams.some(({ externalKey }) => externalKey === myTeamExternalKey)) {
    return { status: "invalid_team" };
  }
  // An early answer for the common refusals, so they skip player matching
  // and its writes. Not authoritative: the transaction checks both again.
  const early = await findImported({ client: prisma, profileId, externalKey: league.externalKey });
  if (early !== null) return { status: "duplicate", slug: early.slug };
  if ((await prisma.league.count({ where: { profileId } })) >= MAX_LEAGUES) {
    return { status: "limit" };
  }
  const resolved = await resolvePlayers({ loaded, writeMappings });
  try {
    return await prisma.$transaction(async (tx): Promise<YahooImportResult> => {
      const existing = await findImported({
        client: tx,
        profileId,
        externalKey: league.externalKey,
      });
      if (existing !== null) return { status: "duplicate", slug: existing.slug };
      const count = await tx.league.count({ where: { profileId } });
      if (count >= MAX_LEAGUES) return { status: "limit" };
      const created = await createImportedLeague({
        tx,
        profileId,
        league,
        resolved,
        waiverRefs,
        myTeamExternalKey,
        syncVia,
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
      profileId,
      externalKey: league.externalKey,
    });
    if (winner === null) throw error;
    return { status: "duplicate", slug: winner.slug };
  }
};

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

/**
 * Reads the caller's own Yahoo import before a sync touches Yahoo: `error` for
 * a league they don't own, `not_imported` for one that isn't a Yahoo import.
 * Whether to refuse on `syncVia` or `throttled`, and in which order, is the
 * caller's to decide.
 */
export const readStoredSync = async ({
  profileId,
  leagueId,
}: {
  profileId: string;
  leagueId: string;
}): Promise<StoredSyncResult> => {
  const stored = await prisma.league.findFirst({
    where: { id: leagueId, profileId },
    select: {
      provider: true,
      syncVia: true,
      externalKey: true,
      syncedAt: true,
      syncError: true,
      updatedAt: true,
    },
  });
  if (stored === null) return { status: "error" };
  // The key reads "478.l.106344"; the part after ".l." is Yahoo's league id.
  const yahooLeagueId = stored.externalKey?.split(".l.")[1] ?? "";
  if (stored.provider !== YAHOO_PROVIDER || stored.externalKey === null || !yahooLeagueId) {
    return { status: "not_imported" };
  }
  return {
    status: "ok",
    league: {
      externalKey: stored.externalKey,
      yahooLeagueId,
      syncVia: stored.syncVia,
      throttled: Date.now() - lastSyncAttempt({ league: stored }) < YAHOO_SYNC_THROTTLE_MS,
    },
  };
};

// The league keeps its last good data on any failure; only the reason is
// recorded, in the import page's copy, so the league page can say why it is
// stale.
const recordSyncFailure = async ({
  profileId,
  leagueId,
  message,
}: {
  profileId: string;
  leagueId: string;
  message: string;
}): Promise<void> => {
  await prisma.league.update({ where: { id: leagueId, profileId }, data: { syncError: message } });
};

/** Records why a sync's read of Yahoo failed, and answers it as a result. */
export const recordLoadFailure = async ({
  profileId,
  leagueId,
  failure,
}: {
  profileId: string;
  leagueId: string;
  failure: YahooLoadFailure;
}): Promise<LoadFailureResult> => {
  const result = loadFailureToResult({ failure });
  await recordSyncFailure({
    profileId,
    leagueId,
    message: yahooFailureMessage({ status: result.status }),
  });
  return result;
};

/**
 * Re-syncs an imported league from a league already read from Yahoo. Any
 * failure is recorded on the league, which keeps its last good data.
 * `storedExternalKey` is the league's key as `readStoredSync` read it.
 */
export const syncLoadedLeague = async ({
  profileId,
  leagueId,
  loaded,
  writeMappings,
  storedExternalKey,
}: {
  profileId: string;
  leagueId: string;
  loaded: LoadedLeague;
  writeMappings: boolean;
  storedExternalKey: string;
}): Promise<YahooSyncResult> => {
  // Yahoo answers a reused league id with another season's league, whose
  // key the guarded update below would refuse; say why up front instead.
  if (loaded.league.externalKey !== storedExternalKey) {
    await recordSyncFailure({ profileId, leagueId, message: KEY_CHANGED_MESSAGE });
    return { status: "error" };
  }

  try {
    const resolved = await resolvePlayers({ loaded, writeMappings });
    const synced = await prisma.$transaction(
      (tx) =>
        syncImportedLeague({
          tx,
          profileId,
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
    await recordSyncFailure({ profileId, leagueId, message: GENERIC_SYNC_ERROR_MESSAGE });
    return { status: "error" };
  }
};
