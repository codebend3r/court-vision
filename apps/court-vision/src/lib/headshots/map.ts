import type { FetchImpl } from "@vision/core/util/fetchImpl";

import { prisma } from "@/lib/prisma";

import { fetchNbaPlayerIndex } from "@/lib/headshots/sources";
import { Logger, consoleLogger, silentLogger } from "@vision/core/util/logger";
import { nameMatchKey } from "@vision/core/util/names";
import { isMainModule } from "@vision/core/util/runtime";

export type MapHeadshotsDeps = {
  fetchImpl?: FetchImpl;
  logger?: Logger;
};

export type MapHeadshotsResult = {
  matched: number;
  unmatched: string[];
};

type NamedRow = {
  fullName: string;
};

// Groups rows by normalized full name. A key with more than one row means an
// ambiguous name on that side of the match (two of our players sharing a
// normalized name, or the NBA index listing two people under one name).
const groupByNormalizedName = <T extends NamedRow>(rows: T[]): Map<string, T[]> =>
  rows.reduce((map, row) => {
    const key = nameMatchKey({ name: row.fullName });
    map.set(key, (map.get(key) ?? []).concat(row));
    return map;
  }, new Map<string, T[]>());

type PersonMatch = {
  id: number;
  nbaPersonId: number;
};

// Only players with at least one game log, or on a current roster, get mapped
// (the plan's "current players" set — see
// docs/superpowers/plans/2026-07-11-player-headshots.md). The roster arm is
// what reaches rookies, who have no logs until they play.
// Ambiguity on either side (0 or 2+ index matches, or two of our players
// normalizing identically) is skipped and reported rather than guessed.
export async function mapHeadshots(deps: MapHeadshotsDeps = {}): Promise<MapHeadshotsResult> {
  const logger = deps.logger ?? silentLogger;
  const index = await fetchNbaPlayerIndex({ fetchImpl: deps.fetchImpl });
  const indexByName = groupByNormalizedName(index);

  const players = await prisma.player.findMany({
    where: { OR: [{ gameLogs: { some: {} } }, { isActive: true }] },
    select: { id: true, fullName: true },
  });
  const playersByName = groupByNormalizedName(players);

  const { matches, unmatched } = Array.from(playersByName.entries()).reduce<{
    matches: PersonMatch[];
    unmatched: string[];
  }>(
    (acc, [name, group]) => {
      if (group.length > 1) {
        return {
          ...acc,
          unmatched: acc.unmatched.concat(group.map((player) => player.fullName)),
        };
      }
      const [player] = group;
      const indexMatches = indexByName.get(name) ?? [];
      if (indexMatches.length !== 1) {
        return { ...acc, unmatched: acc.unmatched.concat(player.fullName) };
      }
      const [indexMatch] = indexMatches;
      return {
        ...acc,
        matches: acc.matches.concat({ id: player.id, nbaPersonId: indexMatch.personId }),
      };
    },
    { matches: [], unmatched: [] },
  );

  // One transaction, so a failed write leaves no run half-applied.
  await prisma.$transaction(
    matches.map((match) =>
      prisma.player.update({
        where: { id: match.id },
        data: { nbaPersonId: match.nbaPersonId },
      }),
    ),
  );

  logger(`Matched ${matches.length} player(s) to an NBA person id.`);
  if (unmatched.length > 0) {
    logger(`Unmatched (${unmatched.length}): ${unmatched.join(", ")}`);
  }

  return { matched: matches.length, unmatched };
}

if (isMainModule({ moduleUrl: import.meta.url })) {
  mapHeadshots({ logger: consoleLogger })
    .then((result) => {
      consoleLogger(
        `Headshot mapping complete: ${result.matched} matched, ${result.unmatched.length} unmatched.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Headshot mapping failed:", error);
      process.exit(1);
    });
}
