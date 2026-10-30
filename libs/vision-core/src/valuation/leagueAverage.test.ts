import { describe, expect, it } from "bun:test";

import {
  aggregateWindowLogs,
  buildLeagueAverageLines,
  type DatedLog,
  makeDatedLog,
} from "#core/testing/basketball";

type LogProps = { day: number; pts: number; minutes?: number };

const log = ({ day, pts, minutes = 30 }: LogProps): DatedLog =>
  makeDatedLog({ gameDate: new Date(Date.UTC(2026, 0, day)), minutes, pts });

describe("buildLeagueAverageLines", () => {
  it("averages the windows of everyone who played each date, in date order", () => {
    const lines = buildLeagueAverageLines({
      players: [
        { playerId: 1, logs: [log({ day: 1, pts: 10 }), log({ day: 3, pts: 30 })] },
        { playerId: 2, logs: [log({ day: 1, pts: 20 })] },
      ],
    });

    expect(lines.map(({ date }) => date)).toEqual([Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 3)]);
    // Day 1: two one-game windows, 10 and 20 points.
    expect(lines[0]?.line.stats.pts).toBe(15);
    expect(lines[0]?.line.gamesPlayed).toBe(1);
    // Day 3: only player 1 played; their window is games 1 and 3.
    expect(lines[1]?.line.stats.pts).toBe(40);
    expect(lines[1]?.line.gamesPlayed).toBe(2);
  });

  it("moves with the league's form from day to day", () => {
    const lines = buildLeagueAverageLines({
      players: [{ playerId: 1, logs: [log({ day: 1, pts: 10 }), log({ day: 2, pts: 50 })] }],
      windowSize: 1,
    });

    expect(lines.map(({ line }) => line.stats.pts)).toEqual([10, 50]);
  });

  it("skips a missed game, which is no reading for that date", () => {
    const lines = buildLeagueAverageLines({
      players: [
        { playerId: 1, logs: [log({ day: 1, pts: 0, minutes: 0 }), log({ day: 2, pts: 8 })] },
      ],
    });

    expect(lines.map(({ date }) => date)).toEqual([Date.UTC(2026, 0, 2)]);
  });

  it("averages every line component, second moments included", () => {
    const first = [log({ day: 1, pts: 10 })];
    const second = [log({ day: 1, pts: 30 })];
    const [day] = buildLeagueAverageLines({
      players: [
        { playerId: 1, logs: first },
        { playerId: 2, logs: second },
      ],
    });
    const a = aggregateWindowLogs({ logs: first });
    const b = aggregateWindowLogs({ logs: second });

    expect(day?.line.sq.pts).toBe((a.sq.pts + b.sq.pts) / 2);
    expect(day?.line.playingTime).toBe((a.playingTime + b.playingTime) / 2);
  });

  it("is empty with no games", () => {
    expect(buildLeagueAverageLines({ players: [] })).toEqual([]);
  });
});
