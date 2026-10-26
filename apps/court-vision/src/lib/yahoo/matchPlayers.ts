import { prisma } from "@/lib/prisma";
import { YAHOO_PROVIDER } from "@/lib/yahoo/constants";
import { type YahooPlayerRef } from "@/lib/yahoo/types";
import { nameMatchKey } from "@vision/core/util/names";

export type MatchCandidate = { id: number; fullName: string; teamAbbr: string | null };
export type MatchMethod = "name_team" | "name_only" | "short_name_team";

export const isMatchMethod = (value: string): value is MatchMethod =>
  value === "name_team" || value === "name_only" || value === "short_name_team";
export type MatchOutcome =
  | { status: "matched"; playerId: number; method: MatchMethod | "existing" }
  | { status: "unmatched" };

const UNMATCHED: MatchOutcome = { status: "unmatched" };

// Yahoo writes "Jimmy Butler III" where Balldontlie writes "Jimmy Butler", and
// the reverse happens too. A suffix is dropped only from a name of three words
// or more, so a two-word name never loses its last name.
const GENERATIONAL_SUFFIXES: ReadonlySet<string> = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

// Names Yahoo prints that Balldontlie spells another way, which no rule below
// can derive: a nickname that is not the start of the legal first name ("Ace"
// for Airious). Both sides are match keys, and the last name is the same on
// both, so an alias only ever picks among players who share it. Each entry
// is a player Balldontlie lists under the legal name; check one against its
// `players` endpoint before adding it.
const NAME_ALIASES: ReadonlyMap<string, string> = new Map([
  ["ace bailey", "airious bailey"],
  ["bub carrington", "carlton carrington"],
]);

// A shortened first name ("nic" for "nicolas") must keep at least this many
// letters, so a bare initial never stands in for a whole first name.
const MIN_SHORT_NAME_LENGTH = 2;

type NameParts = {
  key: string; // nameMatchKey: "jimmy butler iii"
  baseKey: string; // without a generational suffix: "jimmy butler"
  first: string; // "jimmy"
  last: string; // every word after the first, or the only word: "butler"
};

type NamePartsProps = { name: string };

const nameParts = ({ name }: NamePartsProps): NameParts => {
  const key = nameMatchKey({ name });
  const words = key.split(" ");
  const lastWord = words.at(-1) ?? "";
  const baseWords =
    words.length > 2 && GENERATIONAL_SUFFIXES.has(lastWord) ? words.slice(0, -1) : words;
  const [first = ""] = baseWords;
  return {
    key,
    baseKey: baseWords.join(" "),
    first,
    last: baseWords.slice(1).join(" ") || first,
  };
};

// "Nic" and "Nicolas", or "Alex" and "Alexandre": one first name starts the
// other. Sharing only an initial is not enough: "Jalen" and "Jaylin" Williams
// were Oklahoma City teammates.
type IsShortenedFirstNameProps = { left: string; right: string };

const isShortenedFirstName = ({ left, right }: IsShortenedFirstNameProps): boolean => {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= MIN_SHORT_NAME_LENGTH && longer.startsWith(shorter);
};

// Whether two names can belong to one player, by any rule the matcher uses.
// A stored mapping keeps only while this holds, so a trade never drops one.
type NamesAgreeProps = { left: NameParts; right: NameParts };

const namesAgree = ({ left, right }: NamesAgreeProps): boolean =>
  left.baseKey === right.baseKey ||
  (left.last === right.last && isShortenedFirstName({ left: left.first, right: right.first }));

// The matched player among those sharing a name: the one on Yahoo's team, else
// the only one. `null` when none share it, so the caller tries a looser rule;
// unmatched when several do, so an ambiguous name never falls through to one.
type PickByNameProps = {
  ref: YahooPlayerRef;
  sameName: readonly MatchCandidate[];
};

const pickByName = ({ ref, sameName }: PickByNameProps): MatchOutcome | null => {
  if (!sameName.length) return null;
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

// Order: a stored mapping whose name still agrees; the exact name; the name
// without a generational suffix; a known alias; then a shortened first name with the same
// last name on Yahoo's team. Each name rule tries team first, then a name
// exactly one active player has. A shortened first name always needs the team
// and exactly one teammate. An ambiguous name stays unmatched rather than
// guessing, and an empty key (a name that is all punctuation) matches nothing,
// since every other empty key would equal it.
type MatchPlayerProps = {
  ref: YahooPlayerRef;
  candidates: readonly MatchCandidate[];
  existing: MatchCandidate | null;
};

export const matchPlayer = ({ ref, candidates, existing }: MatchPlayerProps): MatchOutcome => {
  const parts = nameParts({ name: ref.fullName });
  if (!parts.key) return UNMATCHED;

  if (existing && namesAgree({ left: parts, right: nameParts({ name: existing.fullName }) })) {
    return { status: "matched", playerId: existing.id, method: "existing" };
  }

  const named = candidates.map((candidate) => ({
    candidate,
    parts: nameParts({ name: candidate.fullName }),
  }));
  const withName = (rule: (other: NameParts) => boolean): MatchCandidate[] =>
    named.filter(({ parts: other }) => rule(other)).map(({ candidate }) => candidate);

  const byName =
    pickByName({ ref, sameName: withName((other) => other.key === parts.key) }) ??
    pickByName({ ref, sameName: withName((other) => other.baseKey === parts.baseKey) });
  if (byName) return byName;

  const aliasKey = NAME_ALIASES.get(parts.key);
  const byAlias =
    aliasKey === undefined
      ? null
      : pickByName({ ref, sameName: withName((other) => other.key === aliasKey) });
  if (byAlias) return byAlias;

  const teammates = withName(
    (other) =>
      other.last === parts.last && isShortenedFirstName({ left: parts.first, right: other.first }),
  ).filter((candidate) => !!ref.teamAbbr && candidate.teamAbbr === ref.teamAbbr);
  const [teammate] = teammates;
  return teammate && teammates.length === 1
    ? { status: "matched", playerId: teammate.id, method: "short_name_team" }
    : UNMATCHED;
};

export type ResolvedPlayers = {
  byYahooId: ReadonlyMap<string, number>;
  unmatched: YahooPlayerRef[];
};

type StoredMapping = {
  method: MatchMethod;
  eligiblePositions: readonly string[];
  player: MatchCandidate;
};
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

// Players the roster sync has not flagged active whose full name is exactly one
// a Yahoo ref carries. Balldontlie's active list is whoever is on a roster
// right now, so a player between teams (or a rookie not yet synced) is on
// Yahoo teams but not in it. Only the unmatched refs ask, and only by their
// own name, so the huge historical pool never joins the candidates and a
// namesake from another era is never one of them.
type LoadInactiveByNameProps = { names: readonly string[] };

const loadInactiveByName = ({ names }: LoadInactiveByNameProps): Promise<MatchCandidate[]> =>
  names.length
    ? prisma.player.findMany({
        where: {
          isActive: false,
          OR: names.map((name) => ({ fullName: { equals: name, mode: "insensitive" } })),
        },
        select: PLAYER_SELECT,
      })
    : Promise.resolve([]);

type LoadStoredMappingsProps = {
  yahooIds: readonly string[];
};

const loadStoredMappings = async ({
  yahooIds,
}: LoadStoredMappingsProps): Promise<ReadonlyMap<string, StoredMapping>> => {
  const rows = await prisma.playerExternalId.findMany({
    where: { provider: YAHOO_PROVIDER, externalId: { in: [...yahooIds] } },
    include: { player: { select: PLAYER_SELECT } },
  });
  // A row with a method this code doesn't write is treated as absent; the
  // upsert below overwrites it.
  return new Map(
    rows.flatMap((row): [string, StoredMapping][] =>
      isMatchMethod(row.method)
        ? [
            [
              row.externalId,
              {
                method: row.method,
                eligiblePositions: row.eligiblePositions,
                player: row.player,
              },
            ],
          ]
        : [],
    ),
  );
};

// Players already held by a Yahoo id outside this batch. Without this a second
// Yahoo id could be name-matched to a player that a stored row already owns.
type LoadHeldPlayerIdsProps = {
  playerIds: readonly number[];
  batchIds: readonly string[];
};

const loadHeldPlayerIds = async ({
  playerIds,
  batchIds,
}: LoadHeldPlayerIdsProps): Promise<ReadonlySet<number>> => {
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

// One upsert per Yahoo player (a 12-team league is ~170) is one round trip
// each, so the batch outlasts Prisma's 5s default over a remote pooler.
const MAPPING_TRANSACTION_OPTIONS = { timeout: 30_000 };

// PlayerExternalId is shared by every profile, so this runs only on the server
// path, from data the server fetched from Yahoo itself. Deletes go first.
type PersistMappingsProps = {
  upserts: readonly { ref: YahooPlayerRef; match: Match }[];
  staleIds: readonly string[];
};

const persistMappings = async ({ upserts, staleIds }: PersistMappingsProps): Promise<void> => {
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
  await prisma.$transaction(operations, MAPPING_TRANSACTION_OPTIONS);
};

type SameStringsProps = {
  left: readonly string[];
  right: readonly string[];
};

const sameStrings = ({ left, right }: SameStringsProps): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

// A stored row that already says exactly this needs no write. Most of a sync's
// refs land here, and each skipped upsert is a statement the request saves.
type IsUnchangedProps = {
  row: StoredMapping | undefined;
  ref: YahooPlayerRef;
  match: Match;
};

const isUnchanged = ({ row, ref, match }: IsUnchangedProps): boolean =>
  !!row &&
  row.player.id === match.playerId &&
  row.method === match.method &&
  sameStrings({ left: row.eligiblePositions, right: ref.eligiblePositions });

// Every rule `matchPlayer` uses needs the same last name, so each ref is only
// compared with the active players who share its last name.
type GroupByLastNameProps = {
  candidates: readonly MatchCandidate[];
};

const groupByLastName = ({
  candidates,
}: GroupByLastNameProps): ReadonlyMap<string, readonly MatchCandidate[]> =>
  candidates.reduce<ReadonlyMap<string, readonly MatchCandidate[]>>((groups, candidate) => {
    const { last } = nameParts({ name: candidate.fullName });
    return new Map(groups).set(last, [...(groups.get(last) ?? []), candidate]);
  }, new Map());

type ResolveYahooPlayersProps = {
  refs: readonly YahooPlayerRef[];
  writeMappings: boolean; // true only on the server path
};

export const resolveYahooPlayers = async ({
  refs,
  writeMappings,
}: ResolveYahooPlayersProps): Promise<ResolvedPlayers> => {
  // A player on a roster and in the waiver pool arrives twice; resolve it once
  // so it can't be mistaken for two Yahoo players claiming one Court Vision row.
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.yahooPlayerId, ref])).values()];
  const batchIds = uniqueRefs.map((ref) => ref.yahooPlayerId);
  const [candidates, stored] = await Promise.all([
    loadCandidates(),
    loadStoredMappings({ yahooIds: batchIds }),
  ]);
  const candidatesByLastName = groupByLastName({ candidates });

  const firstPass = uniqueRefs.map((ref): Attempt => {
    const row = stored.get(ref.yahooPlayerId);
    const outcome = matchPlayer({
      ref,
      candidates: candidatesByLastName.get(nameParts({ name: ref.fullName }).last) ?? [],
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

  // Whoever no active player matched gets a second look among inactive players
  // of exactly that name, unless a stored mapping already speaks for them.
  const needsSecondLook = firstPass.filter(
    ({ ref, match }) => match === undefined && !stored.has(ref.yahooPlayerId),
  );
  const inactiveByLastName = groupByLastName({
    candidates: await loadInactiveByName({
      names: needsSecondLook.map(({ ref }) => ref.fullName),
    }),
  });
  const attempts = firstPass.map((attempt): Attempt => {
    if (!needsSecondLook.includes(attempt)) return attempt;
    const outcome = matchPlayer({
      ref: attempt.ref,
      candidates: inactiveByLastName.get(nameParts({ name: attempt.ref.fullName }).last) ?? [],
      existing: null,
    });
    return outcome.status === "unmatched" || outcome.method === "existing"
      ? attempt
      : { ...attempt, match: { playerId: outcome.playerId, method: outcome.method } };
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
    const upserts = matched.filter(
      ({ ref, match }) =>
        staleIds.includes(ref.yahooPlayerId) ||
        !isUnchanged({ row: stored.get(ref.yahooPlayerId), ref, match }),
    );
    await persistMappings({ upserts, staleIds });
  }

  return {
    byYahooId,
    unmatched: resolved.flatMap(({ ref, match }) => (match ? [] : [ref])),
  };
};
