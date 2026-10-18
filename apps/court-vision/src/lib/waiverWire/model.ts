import { type FantasyPlayerValues, type MethodValueKey } from "@vision/core/valuation/types";
import { parseEligibleGroups } from "@vision/sport-basketball/engine";

import { NON_ROSTER_SLOTS } from "@/lib/leagues/slots";
import { type FantasyStatLine } from "@/lib/valuation/types";
import {
  type WaiverLeagueData,
  type WaiverModel,
  type WaiverOwner,
  type WaiverPosition,
  type WaiverRosterEntry,
  type WaiverRow,
} from "@/lib/waiverWire/types";

const WEAKEST_COUNT = 3;

type RankedValue = { playerId: number; value: number; rank: number };

// Every valued player, highest first, ranked 1..n across the whole pool.
// Ties fall back to playerId so the order is stable.
const rankPool = ({
  values,
  valueKey,
}: {
  values: readonly FantasyPlayerValues[];
  valueKey: MethodValueKey;
}): RankedValue[] =>
  values
    .map((entry) => ({ playerId: entry.playerId, value: entry[valueKey] }))
    .toSorted((a, b) => b.value - a.value || a.playerId - b.playerId)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

const toRow = ({
  ranked,
  line,
  owner,
  injuryStatus,
}: {
  ranked: RankedValue;
  line: FantasyStatLine;
  owner: WaiverOwner;
  injuryStatus: string | null;
}): WaiverRow => ({
  playerId: ranked.playerId,
  fullName: line.fullName,
  teamAbbr: line.teamAbbr,
  position: line.position,
  nbaPersonId: line.nbaPersonId,
  value: ranked.value,
  rank: ranked.rank,
  owner,
  injuryStatus,
});

const matchesPosition = ({ pos, position }: { pos: WaiverPosition; position: string | null }) =>
  pos === "all" || parseEligibleGroups(position).includes(pos);

// Slices the valued pool into the Waiver Wire's views: my healthy roster, its
// three weakest players, my players with no line in the range, and the free
// pool. IL and IL+ players are never part of my roster, and a player without
// a line is never treated as low value.
export const buildWaiverModel = ({
  lines,
  values,
  valueKey,
  league,
  activePlayerIds,
  pos,
}: {
  lines: readonly FantasyStatLine[];
  values: readonly FantasyPlayerValues[];
  valueKey: MethodValueKey;
  league: WaiverLeagueData;
  activePlayerIds: ReadonlySet<number>;
  pos: WaiverPosition;
}): WaiverModel => {
  const lineById = new Map(lines.map((line) => [line.playerId, line]));
  const ranked = rankPool({ values, valueKey });
  const rankedById = new Map(ranked.map((entry) => [entry.playerId, entry]));

  const healthy = league.myRoster.filter((entry) => !NON_ROSTER_SLOTS.includes(entry.slotType));
  const healthyById = new Map(healthy.map((entry) => [entry.playerId, entry]));
  const isValued = (entry: WaiverRosterEntry) =>
    lineById.has(entry.playerId) && rankedById.has(entry.playerId);

  const roster = ranked.flatMap((entry) => {
    const rosterEntry = healthyById.get(entry.playerId);
    const line = lineById.get(entry.playerId);
    return !!rosterEntry && !!line
      ? [toRow({ ranked: entry, line, owner: "mine", injuryStatus: rosterEntry.injuryStatus })]
      : [];
  });

  // Every rostered id, mine included even when the caller left my IL players
  // out of `rosteredPlayerIds`, so none of my players can surface as free.
  const rostered = new Set([
    ...league.rosteredPlayerIds,
    ...league.myRoster.map((entry) => entry.playerId),
  ]);
  const waiverById = new Map(league.waivers.map((waiver) => [waiver.playerId, waiver]));

  const freePool = ranked.flatMap((entry) => {
    const line = lineById.get(entry.playerId);
    const isFree =
      !!line &&
      activePlayerIds.has(entry.playerId) &&
      !rostered.has(entry.playerId) &&
      matchesPosition({ pos, position: line.position });
    const waiver = waiverById.get(entry.playerId);
    return isFree
      ? [
          toRow({
            ranked: entry,
            line,
            owner: !!waiver ? "waivers" : "free_agent",
            injuryStatus: waiver?.injuryStatus ?? null,
          }),
        ]
      : [];
  });

  return {
    roster,
    noStats: healthy.filter(
      (entry, index) =>
        !isValued(entry) &&
        healthy.findIndex((other) => other.playerId === entry.playerId) === index,
    ),
    weakest: roster.slice(-WEAKEST_COUNT).toReversed(),
    freePool,
  };
};
