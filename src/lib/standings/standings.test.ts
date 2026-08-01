import { describe, expect, it } from "bun:test";

import { type BdlStanding } from "@/lib/balldontlie/schemas";
import { groupStandings } from "@/lib/standings/standings";

const standing = ({
  id,
  conference,
  rank,
  wins,
}: {
  id: number;
  conference: string;
  rank: number;
  wins: number;
}): BdlStanding => ({
  team: {
    id,
    conference,
    abbreviation: `T${id}`,
    full_name: `Team ${id}`,
  },
  conference_rank: rank,
  wins,
  losses: 82 - wins,
  season: 2025,
});

describe("groupStandings", () => {
  it("splits teams into their conferences", () => {
    const grouped = groupStandings({
      rows: [
        standing({ id: 1, conference: "East", rank: 1, wins: 60 }),
        standing({ id: 2, conference: "West", rank: 1, wins: 58 }),
      ],
    });
    expect(grouped.east.map((team) => team.teamId)).toEqual([1]);
    expect(grouped.west.map((team) => team.teamId)).toEqual([2]);
  });

  it("orders each conference by rank regardless of input order", () => {
    const grouped = groupStandings({
      rows: [
        standing({ id: 3, conference: "East", rank: 3, wins: 45 }),
        standing({ id: 1, conference: "East", rank: 1, wins: 60 }),
        standing({ id: 2, conference: "East", rank: 2, wins: 50 }),
      ],
    });
    expect(grouped.east.map((team) => team.rank)).toEqual([1, 2, 3]);
  });

  it("carries identity and record through to the view shape", () => {
    const grouped = groupStandings({
      rows: [standing({ id: 7, conference: "West", rank: 4, wins: 48 })],
    });
    expect(grouped.west[0]).toEqual({
      teamId: 7,
      abbreviation: "T7",
      fullName: "Team 7",
      rank: 4,
      wins: 48,
      losses: 34,
    });
  });

  it("drops rows from a conference it does not chart", () => {
    const grouped = groupStandings({
      rows: [standing({ id: 9, conference: "Central", rank: 1, wins: 40 })],
    });
    expect(grouped.east).toEqual([]);
    expect(grouped.west).toEqual([]);
  });
});
