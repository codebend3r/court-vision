import { describe, expect, it } from "bun:test";

import {
  buildTrending,
  freePlayerIds,
  MIN_TREND_GAMES,
  TRENDING_LIMIT,
} from "@/lib/advisor/trending";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type FantasyStatLine } from "@/lib/valuation/types";

// A stand-in yardstick: points per game.
type ScoreLineProps = { line: FantasyStatLine };

const scoreLine = ({ line }: ScoreLineProps): number => line.stats.pts / line.gamesPlayed;

type PairProps = { playerId: number; season: number; recent: number; recentGames?: number };

// Season and last-ten lines for one player, by points per game.
const pair = ({ playerId, season, recent, recentGames = 10 }: PairProps) => ({
  season: makeStatLine({ playerId, gamesPlayed: 40, pts: season * 40 }),
  recent: makeStatLine({ playerId, gamesPlayed: recentGames, pts: recent * recentGames }),
});

type LinesOfProps = { pairs: ReturnType<typeof pair>[] };

const linesOf = ({ pairs }: LinesOfProps) => ({
  season: pairs.map(({ season }) => season),
  recent: pairs.map(({ recent }) => recent),
});

describe("freePlayerIds", () => {
  it("keeps active players nobody rosters, mine included as rostered", () => {
    const ids = freePlayerIds({
      league: {
        rosteredPlayerIds: [1],
        myRoster: [{ playerId: 2, fullName: "Mine", slotType: "IL", injuryStatus: "O" }],
      },
      activePlayerIds: [1, 2, 3, 4],
    });
    expect([...ids]).toEqual([3, 4]);
  });
});

describe("buildTrending", () => {
  it("ranks free players by how far recent form beats the season", () => {
    const rows = buildTrending({
      lines: linesOf({
        pairs: [
          pair({ playerId: 1, season: 10, recent: 12 }),
          pair({ playerId: 2, season: 10, recent: 18 }),
          pair({ playerId: 3, season: 10, recent: 8 }),
        ],
      }),
      freeIds: new Set([1, 2, 3]),
      waivers: [{ playerId: 2, injuryStatus: "Q" }],
      scoreLine,
    });
    expect(rows.map(({ playerId, change }) => [playerId, change])).toEqual([
      [2, 8],
      [1, 2],
    ]);
    expect(rows[0]).toMatchObject({ owner: "waivers", injuryStatus: "Q", recentGames: 10 });
    expect(rows[1]?.owner).toBe("free_agent");
  });

  it("leaves out rostered players and thin recent samples", () => {
    const rows = buildTrending({
      lines: linesOf({
        pairs: [
          pair({ playerId: 1, season: 10, recent: 20 }),
          pair({ playerId: 2, season: 10, recent: 20, recentGames: MIN_TREND_GAMES - 1 }),
          pair({ playerId: 3, season: 10, recent: 11 }),
        ],
      }),
      freeIds: new Set([2, 3]),
      waivers: [],
      scoreLine,
    });
    expect(rows.map(({ playerId }) => playerId)).toEqual([3]);
  });

  it("stops at ten", () => {
    const pairs = Array.from({ length: 15 }, (_, index) =>
      pair({ playerId: index + 1, season: 10, recent: 11 + index }),
    );
    const rows = buildTrending({
      lines: linesOf({ pairs }),
      freeIds: new Set(pairs.map(({ season }) => season.playerId)),
      waivers: [],
      scoreLine,
    });
    expect(rows).toHaveLength(TRENDING_LIMIT);
    expect(rows[0]?.playerId).toBe(15);
  });
});
