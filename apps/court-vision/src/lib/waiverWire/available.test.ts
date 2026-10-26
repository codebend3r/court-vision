import { describe, expect, it } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { AVAILABLE_COLUMNS, filterAvailable } from "@/lib/waiverWire/available";
import { type WaiverRow } from "@/lib/waiverWire/types";

type CellsProps = { line: ReturnType<typeof makeStatLine> };

const cells = ({ line }: CellsProps): Record<string, string> =>
  Object.fromEntries(AVAILABLE_COLUMNS.map((column) => [column.label, column.cell(line)]));

describe("AVAILABLE_COLUMNS", () => {
  it("reads the categories per game", () => {
    const line = makeStatLine({
      playerId: 1,
      gamesPlayed: 10,
      pts: 200,
      reb: 80,
      ast: 50,
      fgm: 80,
      fga: 160,
      ftm: 30,
      fta: 40,
    });
    expect(cells({ line })).toMatchObject({
      GP: "10",
      PTS: "20.0",
      REB: "8.0",
      AST: "5.0",
      "FG%": ".500",
      "FT%": ".750",
    });
  });

  it("has no per-game value for a player with no games, and no rate without attempts", () => {
    const line = makeStatLine({ playerId: 2, gamesPlayed: 0, pts: 0, fga: 0, fta: 0 });
    expect(cells({ line })).toMatchObject({ GP: "0", PTS: "—", "FG%": "—", "FT%": "—" });
  });
});

type RowProps = { playerId: number; fullName: string };

const row = ({ playerId, fullName }: RowProps): WaiverRow => ({
  playerId,
  fullName,
  teamAbbr: null,
  position: null,
  nbaPersonId: null,
  value: 0,
  rank: playerId,
  owner: "free_agent",
  injuryStatus: null,
});

describe("filterAvailable", () => {
  const rows = [
    row({ playerId: 1, fullName: "Jalen Smith" }),
    row({ playerId: 2, fullName: "Jaylen Brown" }),
    row({ playerId: 3, fullName: "Kon Knueppel" }),
  ];

  it("keeps everyone for an empty or blank search", () => {
    expect(filterAvailable({ rows, q: "" })).toHaveLength(3);
    expect(filterAvailable({ rows, q: "   " })).toHaveLength(3);
  });

  it("matches a name part, ignoring case, and keeps the value order", () => {
    expect(filterAvailable({ rows, q: "JAL" }).map((entry) => entry.playerId)).toEqual([1]);
    expect(filterAvailable({ rows, q: "len" }).map((entry) => entry.playerId)).toEqual([1, 2]);
  });

  it("matches nobody for a name nobody has", () => {
    expect(filterAvailable({ rows, q: "zzz" })).toEqual([]);
  });
});
