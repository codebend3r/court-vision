import { describe, expect, it } from "bun:test";

import { basketballFixture } from "#core/testing/basketballDescriptor";
import { makeLine } from "#core/testing/lines";

describe("makeLine", () => {
  const line = makeLine({
    sport: basketballFixture,
    playerId: 3,
    position: "C",
    gamesPlayed: 10,
    playingTime: 300,
    stats: { pts: 200, fgm: 80, fga: 160 },
  });

  it("fills absent stats with 0", () => {
    expect(line.stats.reb).toBe(0);
    expect(line.stats.pts).toBe(200);
  });

  it("derives the moments of a player who repeats the same game", () => {
    expect(line.sq.pts).toBe((200 * 200) / 10);
    expect(line.cross).toEqual({ fg: (80 * 160) / 10, ft: 0 });
  });

  it("leaves every moment at 0 for a player with no games", () => {
    const idle = makeLine({
      sport: basketballFixture,
      playerId: 4,
      position: null,
      gamesPlayed: 0,
      playingTime: 0,
      stats: { pts: 10, fgm: 2, fga: 4 },
    });
    expect(idle.sq.pts).toBe(0);
    expect(idle.cross.fg).toBe(0);
  });
});
