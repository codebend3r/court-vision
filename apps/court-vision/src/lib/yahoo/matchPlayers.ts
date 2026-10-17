import { prisma } from "@/lib/prisma";
import { YAHOO_PROVIDER } from "@/lib/yahoo/constants";
import { type YahooPlayerRef } from "@/lib/yahoo/types";
import { nameMatchKey } from "@vision/core/util/names";

export type MatchCandidate = { id: number; fullName: string; teamAbbr: string | null };
export type MatchMethod = "name_team" | "name_only";

export const isMatchMethod = (value: string): value is MatchMethod =>
  value === "name_team" || value === "name_only";
export type MatchOutcome =
  | { status: "matched"; playerId: number; method: MatchMethod | "existing" }
  | { status: "unmatched" };

const UNMATCHED: MatchOutcome = { status: "unmatched" };

// Order: a stored mapping whose name still agrees, then name + team, then a
// name that exactly one active player has. An ambiguous name stays unmatched
// rather than guessing, and an empty key (a name that is all punctuation)
// matches nothing, since every other empty key would equal it.
export const matchPlayer = ({
  ref,
  candidates,
  existing,
}: {
  ref: YahooPlayerRef;
  candidates: readonly MatchCandidate[];
  existing: MatchCandidate | null;
}): MatchOutcome => {
  const key = nameMatchKey({ name: ref.fullName });
  if (!key) return UNMATCHED;

  if (existing && nameMatchKey({ name: existing.fullName }) === key) {
    return { status: "matched", playerId: existing.id, method: "existing" };
  }

  const sameName = candidates.filter(
    (candidate) => nameMatchKey({ name: candidate.fullName }) === key,
  );
  const sameTeam = sameName.filter(
    (candidate) => !!ref.teamAbbr && candidate.teamAbbr === ref.teamAbbr,
  );

  const [byTeam] = sameTeam;
  if (byTeam && sameTeam.length === 1) {
    return { status: "matched", playerId: byTeam.id, method: "name_team" };
  }
  // Two players sharing a name and a team cannot be told apart by name alone.
  if (sameTeam.length > 1) return UNMATCHED;

  const [byName] = sameName;
  if (byName && sameName.length === 1) {
    return { status: "matched", playerId: byName.id, method: "name_only" };
  }
  return UNMATCHED;
};

export type ResolvedPlayers = {
  byYahooId: ReadonlyMap<string, number>;
  unmatched: YahooPlayerRef[];
};

type StoredMapping = { method: MatchMethod; player: MatchCandidate };
type Match = { playerId: number; method: MatchMethod };
type Attempt = {
  ref: YahooPlayerRef;
  match: Match | undefined;
  // True when the stored row's name still agrees with the ref. Such a row is
  // never deleted, even if the ref then loses a conflict.
  keepsStored: boolean;
};

const PLAYER_SELECT = { id: true, fullName: true, teamAbbr: true } as const;

const loadCandidates = (): Promise<MatchCandidate[]> =>
  prisma.player.findMany({ where: { isActive: true }, select: PLAYER_SELECT });

const loadStoredMappings = async ({
  yahooIds,
}: {
  yahooIds: readonly string[];
}): Promise<ReadonlyMap<string, StoredMapping>> => {
  const rows = await prisma.playerExternalId.findMany({
    where: { provider: YAHOO_PROVIDER, externalId: { in: [...yahooIds] } },
    include: { player: { select: PLAYER_SELECT } },
  });
  // A row with a method this code doesn't write is treated as absent; the
  // upsert below overwrites it.
  return new Map(
    rows.flatMap((row): [string, StoredMapping][] =>
      isMatchMethod(row.method)
        ? [[row.externalId, { method: row.method, player: row.player }]]
        : [],
    ),
  );
};

// Players already held by a Yahoo id outside this batch. Without this a second
// Yahoo id could be name-matched to a player that a stored row already owns.
const loadHeldPlayerIds = async ({
  playerIds,
  batchIds,
}: {
  playerIds: readonly number[];
  batchIds: readonly string[];
}): Promise<ReadonlySet<number>> => {
  if (!playerIds.length) return new Set();
  const rows = await prisma.playerExternalId.findMany({
    where: {
      provider: YAHOO_PROVIDER,
      playerId: { in: [...playerIds] },
      externalId: { notIn: [...batchIds] },
    },
    select: { playerId: true },
  });
  return new Set(rows.map((row) => row.playerId));
};

// PlayerExternalId is shared by every profile, so this runs only on the server
// path, from data the server fetched from Yahoo itself. Deletes go first.
const persistMappings = async ({
  upserts,
  staleIds,
}: {
  upserts: readonly { ref: YahooPlayerRef; match: Match }[];
  staleIds: readonly string[];
}): Promise<void> => {
  const operations = [
    ...(staleIds.length
      ? [
          prisma.playerExternalId.deleteMany({
            where: { provider: YAHOO_PROVIDER, externalId: { in: [...staleIds] } },
          }),
        ]
      : []),
    ...upserts.map(({ ref, match }) =>
      prisma.playerExternalId.upsert({
        where: {
          provider_externalId: { provider: YAHOO_PROVIDER, externalId: ref.yahooPlayerId },
        },
        create: {
          provider: YAHOO_PROVIDER,
          externalId: ref.yahooPlayerId,
          playerId: match.playerId,
          method: match.method,
          eligiblePositions: ref.eligiblePositions,
        },
        update: {
          playerId: match.playerId,
          method: match.method,
          eligiblePositions: ref.eligiblePositions,
        },
      }),
    ),
  ];
  if (!operations.length) return;
  await prisma.$transaction(operations);
};

const groupByNameKey = ({
  candidates,
}: {
  candidates: readonly MatchCandidate[];
}): ReadonlyMap<string, readonly MatchCandidate[]> =>
  candidates.reduce<ReadonlyMap<string, readonly MatchCandidate[]>>((groups, candidate) => {
    const key = nameMatchKey({ name: candidate.fullName });
    return new Map(groups).set(key, [...(groups.get(key) ?? []), candidate]);
  }, new Map());

export const resolveYahooPlayers = async ({
  refs,
  writeMappings,
}: {
  refs: readonly YahooPlayerRef[];
  writeMappings: boolean; // true only on the server path
}): Promise<ResolvedPlayers> => {
  // A player on a roster and in the waiver pool arrives twice; resolve it once
  // so it can't be mistaken for two Yahoo players claiming one Court Vision row.
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.yahooPlayerId, ref])).values()];
  const batchIds = uniqueRefs.map((ref) => ref.yahooPlayerId);
  const [candidates, stored] = await Promise.all([
    loadCandidates(),
    loadStoredMappings({ yahooIds: batchIds }),
  ]);
  const candidatesByKey = groupByNameKey({ candidates });

  const attempts = uniqueRefs.map((ref): Attempt => {
    const row = stored.get(ref.yahooPlayerId);
    const outcome = matchPlayer({
      ref,
      candidates: candidatesByKey.get(nameMatchKey({ name: ref.fullName })) ?? [],
      existing: row?.player ?? null,
    });
    if (outcome.status === "unmatched") return { ref, match: undefined, keepsStored: false };
    if (outcome.method !== "existing") {
      return {
        ref,
        match: { playerId: outcome.playerId, method: outcome.method },
        keepsStored: false,
      };
    }
    return {
      ref,
      match: row && { playerId: outcome.playerId, method: row.method },
      keepsStored: true,
    };
  });

  // A Court Vision player claimed by several refs belongs to none of them.
  const claims = attempts.reduce<ReadonlyMap<number, number>>(
    (counts, { match }) =>
      match ? new Map(counts).set(match.playerId, (counts.get(match.playerId) ?? 0) + 1) : counts,
    new Map(),
  );
  const unclaimed = attempts.map((attempt) =>
    attempt.match && (claims.get(attempt.match.playerId) ?? 0) > 1
      ? { ...attempt, match: undefined }
      : attempt,
  );

  // Nor may it already belong to a Yahoo id outside this batch.
  const held = await loadHeldPlayerIds({
    playerIds: unclaimed.flatMap(({ match }) => (match ? [match.playerId] : [])),
    batchIds,
  });
  const resolved = unclaimed.map((attempt) =>
    attempt.match && held.has(attempt.match.playerId) ? { ...attempt, match: undefined } : attempt,
  );

  const matched = resolved.flatMap(({ ref, match }) => (match ? [{ ref, match }] : []));
  const byYahooId = new Map(matched.map(({ ref, match }) => [ref.yahooPlayerId, match.playerId]));

  if (writeMappings) {
    // Stale means the stored name no longer agrees (the ref was rematched or
    // is unmatched), never merely that the ref lost a conflict.
    const staleIds = resolved
      .filter(({ ref, keepsStored }) => stored.has(ref.yahooPlayerId) && !keepsStored)
      .map(({ ref }) => ref.yahooPlayerId);
    await persistMappings({ upserts: matched, staleIds });
  }

  return {
    byYahooId,
    unmatched: resolved.flatMap(({ ref, match }) => (match ? [] : [ref])),
  };
};
