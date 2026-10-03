import { describe, expect, it } from "bun:test";

import { buildCumulativeWins } from "@/lib/teams/trend";
import { type TeamGameResult } from "@/lib/teams/stats";

const result = ({
  teamAbbr,
  gameId,
  winLoss,
  date,
}: {
  teamAbbr: string;
  gameId: string;
  winLoss: string | null;
  date: string;
}): TeamGameResult => ({
  teamAbbr,
  gameId,
  teamScore: null,
  opponentScore: null,
  winLoss,
  gameDate: new Date(date),
});

describe("buildCumulativeWins", () => {
  it("accumulates wins per team in date order", () => {
    const results = [
      result({ teamAbbr: "BOS", gameId: "1", winLoss: "W", date: "2025-10-22" }),
      result({ teamAbbr: "BOS", gameId: "2", winLoss: "L", date: "2025-10-24" }),
      result({ teamAbbr: "BOS", gameId: "3", winLoss: "W", date: "2025-10-26" }),
      result({ teamAbbr: "NYK", gameId: "4", winLoss: "L", date: "2025-10-23" }),
    ];
    const rows = buildCumulativeWins({ results, abbrs: ["BOS", "NYK"] });
    expect(rows).toEqual([
      { game: 1, BOS: 1, NYK: 0 },
      { game: 2, BOS: 1 },
      { game: 3, BOS: 2 },
    ]);
  });

  it("ignores teams not in the block and null results", () => {
    const results = [
      result({ teamAbbr: "LAL", gameId: "1", winLoss: "W", date: "2025-10-22" }),
      result({ teamAbbr: "BOS", gameId: "2", winLoss: null, date: "2025-10-22" }),
      result({ teamAbbr: "BOS", gameId: "3", winLoss: "W", date: "2025-10-24" }),
    ];
    const rows = buildCumulativeWins({ results, abbrs: ["BOS"] });
    expect(rows).toEqual([
      { game: 1, BOS: 0 },
      { game: 2, BOS: 1 },
    ]);
  });

  it("returns no rows when the block has no results", () => {
    expect(buildCumulativeWins({ results: [], abbrs: ["BOS"] })).toEqual([]);
  });
});
