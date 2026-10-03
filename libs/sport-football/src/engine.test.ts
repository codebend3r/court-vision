import { describe, expect, it } from "bun:test";

import { recordFromKeys } from "@vision/core/util/record";
import { type ValuationLine } from "@vision/core/valuation/types";

import { FOOTBALL_VALUED_STATS, type FootballKeys } from "#football/descriptor";
import { footballEngine } from "#football/engine";

type Stats = Partial<Record<FootballKeys["valued"], number>>;

const line = ({
  playerId,
  position,
  stats,
}: {
  playerId: number;
  position: string;
  stats: Stats;
}): ValuationLine<FootballKeys> => {
  const totals = recordFromKeys({ keys: FOOTBALL_VALUED_STATS, value: (key) => stats[key] ?? 0 });
  return {
    playerId,
    position,
    gamesPlayed: 17,
    playingTime: 17,
    stats: totals,
    sq: totals,
    cross: {},
  };
};

// Season totals worth these PPR points: QBs 400/380, RBs 300/200/100, WR 250.
const LINES = [
  line({ playerId: 1, position: "QB", stats: { passYds: 5000, passTd: 50 } }),
  line({ playerId: 2, position: "QB", stats: { passYds: 4500, passTd: 50 } }),
  line({ playerId: 3, position: "RB", stats: { rushYds: 1800, rushTd: 20 } }),
  line({ playerId: 4, position: "RB", stats: { rushYds: 1400, rushTd: 10 } }),
  line({ playerId: 5, position: "RB", stats: { rushYds: 1000 } }),
  line({ playerId: 6, position: "WR", stats: { rec: 100, recYds: 1500 } }),
];

const value = () =>
  footballEngine.valuePlayers({
    lines: LINES,
    config: { ...footballEngine.defaultValuationConfig, teams: 1, rosterSlots: 3, basis: "total" },
    windowGames: null,
  }).values;

describe("valuing football players", () => {
  it("prices the stat line in PPR points", () => {
    const byId = new Map(value().map((entry) => [entry.playerId, entry.points]));
    expect(byId.get(1)).toBeCloseTo(400, 10);
    expect(byId.get(3)).toBeCloseTo(300, 10);
    expect(byId.get(6)).toBeCloseTo(250, 10);
  });

  it("subtracts the replacement player's points for VORP", () => {
    // One team, three slots: the third-best total (300) is replacement.
    const vorp = new Map(value().map((entry) => [entry.playerId, entry.vorp]));
    expect(vorp.get(1)).toBeCloseTo(100, 10);
    expect(vorp.get(3)).toBeCloseTo(0, 10);
  });

  it("values players over their own position's replacement", () => {
    // One team: QB replacement is the 1st QB (400), RB the 2nd RB (200).
    const positional = new Map(value().map((entry) => [entry.playerId, entry.positional]));
    expect(positional.get(1)).toBeCloseTo(0, 10);
    expect(positional.get(3)).toBeCloseTo(100, 10);
  });

  it("leaves the category methods at zero for a sport without categories", () => {
    expect(value().every((entry) => entry.z === 0 && entry.g === 0 && entry.sgp === 0)).toBe(true);
  });

  it("lets a flex slot take running backs, receivers, and tight ends only", () => {
    expect(footballEngine.eligibleForSlot({ slotType: "FLEX", position: "TE" })).toBe(true);
    expect(footballEngine.eligibleForSlot({ slotType: "FLEX", position: "QB" })).toBe(false);
  });
});
