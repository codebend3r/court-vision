import { normalizeName } from "@/lib/demo/names";
import { prisma } from "@/lib/prisma";

import { fetchNbaPlayerIndex } from "@/lib/headshots/sources";
import { isMainModule } from "@/lib/runtime";

export type MapHeadshotsDeps = {
  fetchImpl?: typeof fetch;
};

export type MapHeadshotsResult = {
  matched: number;
  unmatched: string[];
};

type NamedRow = {
  fullName: string;
};

// Sources disagree on punctuation ("A.J. Green" here vs "AJ Green" in the NBA
// index, apostrophes, hyphens), so the match key drops everything but letters,
// digits, and single spaces after diacritic normalization.
const matchKey = (name: string): string =>
  normalizeName(name)
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Groups rows by normalized full name. A key with more than one row means an
// ambiguous name on that side of the match (two of our players sharing a
// normalized name, or the NBA index listing two people under one name).
const groupByNormalizedName = <T extends NamedRow>(rows: T[]): Map<string, T[]> =>
  rows.reduce((map, row) => {
    const key = matchKey(row.fullName);
    map.set(key, (map.get(key) ?? []).concat(row));
    return map;
  }, new Map<string, T[]>());

type PersonMatch = {
  id: number;
  nbaPersonId: number;
};

// Only players with at least one game log get mapped (the plan's "current
// players" set — see docs/superpowers/plans/2026-07-11-player-headshots.md).
// Ambiguity on either side (0 or 2+ index matches, or two of our players
// normalizing identically) is skipped and reported rather than guessed.
export async function mapHeadshots(deps: MapHeadshotsDeps = {}): Promise<MapHeadshotsResult> {
  const index = await fetchNbaPlayerIndex({ fetchImpl: deps.fetchImpl });
  const indexByName = groupByNormalizedName(index);

  const players = await prisma.player.findMany({
    where: { gameLogs: { some: {} } },
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

  await matches.reduce(async (previous, match) => {
    await previous;
    await prisma.player.update({
      where: { id: match.id },
      data: { nbaPersonId: match.nbaPersonId },
    });
  }, Promise.resolve());

  console.log(`Matched ${matches.length} player(s) to an NBA person id.`);
  if (unmatched.length > 0) {
    console.log(`Unmatched (${unmatched.length}): ${unmatched.join(", ")}`);
  }

  return { matched: matches.length, unmatched };
}

if (isMainModule({ moduleUrl: import.meta.url })) {
  mapHeadshots()
    .then((result) => {
      console.log(
        `Headshot mapping complete: ${result.matched} matched, ${result.unmatched.length} unmatched.`,
      );
    })
    .catch((error: unknown) => {
      console.error("Headshot mapping failed:", error);
      process.exit(1);
    });
}
