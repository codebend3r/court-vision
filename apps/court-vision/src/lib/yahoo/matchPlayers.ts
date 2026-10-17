import { prisma } from "@/lib/prisma";
import { YAHOO_PROVIDER } from "@/lib/yahoo/constants";
import { type YahooPlayerRef } from "@/lib/yahoo/types";
import { nameMatchKey } from "@vision/core/util/names";

export type MatchCandidate = { id: number; fullName: string; teamAbbr: string | null };
export type MatchMethod = "name_team" | "name_only";
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

type StoredMapping = { method: string; player: MatchCandidate };

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
  return new Map(rows.map((row) => [row.externalId, { method: row.method, player: row.player }]));
};

// PlayerExternalId is shared by every profile, so this runs only on the server
// path, from data the server fetched from Yahoo itself.
const writeMappings = async ({
  upserts,
  staleIds,
}: {
  upserts: readonly {
    ref: YahooPlayerRef;
    playerId: number;
    method: string;
  }[];
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
    ...upserts.map(({ ref, playerId, method }) =>
      prisma.playerExternalId.upsert({
        where: {
          provider_externalId: { provider: YAHOO_PROVIDER, externalId: ref.yahooPlayerId },
        },
        create: {
          provider: YAHOO_PROVIDER,
          externalId: ref.yahooPlayerId,
          playerId,
          method,
          eligiblePositions: ref.eligiblePositions,
        },
        update: { playerId, method, eligiblePositions: ref.eligiblePositions },
      }),
    ),
  ];
  if (!operations.length) return;
  await prisma.$transaction(operations);
};

export const resolveYahooPlayers = async ({
  refs,
  writeMappings: shouldWrite,
}: {
  refs: readonly YahooPlayerRef[];
  writeMappings: boolean; // true only on the server path
}): Promise<ResolvedPlayers> => {
  // A player on a roster and in the waiver pool arrives twice; resolve it once
  // so it can't be mistaken for two Yahoo players claiming one Court Vision row.
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.yahooPlayerId, ref])).values()];
  const [candidates, stored] = await Promise.all([
    loadCandidates(),
    loadStoredMappings({ yahooIds: uniqueRefs.map((ref) => ref.yahooPlayerId) }),
  ]);

  const matches = uniqueRefs.map((ref) => ({
    ref,
    outcome: matchPlayer({
      ref,
      candidates,
      existing: stored.get(ref.yahooPlayerId)?.player ?? null,
    }),
  }));

  const claims = matches.reduce<ReadonlyMap<number, number>>(
    (counts, { outcome }) =>
      outcome.status === "matched"
        ? new Map(counts).set(outcome.playerId, (counts.get(outcome.playerId) ?? 0) + 1)
        : counts,
    new Map(),
  );

  // A Court Vision player claimed by several refs belongs to none of them.
  const resolved = matches.map(({ ref, outcome }) =>
    outcome.status === "matched" && (claims.get(outcome.playerId) ?? 0) === 1
      ? { ref, outcome }
      : { ref, outcome: UNMATCHED },
  );

  const matched = resolved.flatMap(({ ref, outcome }) =>
    outcome.status === "matched"
      ? [
          {
            ref,
            playerId: outcome.playerId,
            method:
              outcome.method === "existing"
                ? (stored.get(ref.yahooPlayerId)?.method ?? "name_only")
                : outcome.method,
          },
        ]
      : [],
  );

  const matchedPlayerIds = new Map(
    matched.map(({ ref, playerId }) => [ref.yahooPlayerId, playerId]),
  );
  const staleIds = uniqueRefs
    .map((ref) => ref.yahooPlayerId)
    .filter((id) => stored.has(id) && stored.get(id)?.player.id !== matchedPlayerIds.get(id));

  if (shouldWrite) await writeMappings({ upserts: matched, staleIds });

  return {
    byYahooId: new Map(matched.map(({ ref, playerId }) => [ref.yahooPlayerId, playerId])),
    unmatched: resolved.flatMap(({ ref, outcome }) => (outcome.status === "matched" ? [] : [ref])),
  };
};
