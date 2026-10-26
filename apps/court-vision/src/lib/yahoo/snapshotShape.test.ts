import { describe, expect, it } from "bun:test";

import {
  gameOfCourtsPayload,
  snapshotWithRosterSize,
  snapshotWithTeamCount,
  waiverPageWithPlayers,
} from "@/lib/yahoo/fixtures/oversized";
import waivers106344 from "@/lib/yahoo/fixtures/waivers-106344.json";
import {
  checkSnapshotShape,
  MAX_SNAPSHOT_ROSTER_PLAYERS,
  MAX_SNAPSHOT_TEAMS,
  type SnapshotShape,
} from "@/lib/yahoo/snapshotShape";

const OK: SnapshotShape = { status: "ok" };
const OVER: SnapshotShape = { status: "over" };

describe("checkSnapshotShape", () => {
  it("passes the Game of Courts payload", () => {
    expect(checkSnapshotShape({ payload: gameOfCourtsPayload() })).toEqual(OK);
  });

  it("caps a snapshot at 32 teams", () => {
    expect(MAX_SNAPSHOT_TEAMS).toBe(32);
    const atCap = gameOfCourtsPayload({ snapshot: snapshotWithTeamCount({ count: 32 }) });
    const overCap = gameOfCourtsPayload({ snapshot: snapshotWithTeamCount({ count: 33 }) });

    expect(checkSnapshotShape({ payload: atCap })).toEqual(OK);
    expect(checkSnapshotShape({ payload: overCap })).toEqual(OVER);
  });

  it("caps the scoreboard at 32 matchups", () => {
    const scoreboard = ({ count }: { count: number }) => ({
      fantasy_content: {
        league: {
          scoreboard: { matchups: Array.from({ length: count }, () => ({ matchup: {} })) },
        },
      },
    });

    expect(
      checkSnapshotShape({
        payload: { ...gameOfCourtsPayload(), scoreboard: scoreboard({ count: 32 }) },
      }),
    ).toEqual(OK);
    expect(
      checkSnapshotShape({
        payload: { ...gameOfCourtsPayload(), scoreboard: scoreboard({ count: 33 }) },
      }),
    ).toEqual(OVER);
  });

  it("passes a payload with no scoreboard", () => {
    expect(
      checkSnapshotShape({ payload: { ...gameOfCourtsPayload(), scoreboard: "junk" } }),
    ).toEqual(OK);
  });

  it("caps any one team's roster at 64 players", () => {
    expect(MAX_SNAPSHOT_ROSTER_PLAYERS).toBe(64);
    const atCap = gameOfCourtsPayload({ snapshot: snapshotWithRosterSize({ count: 64 }) });
    const overCap = gameOfCourtsPayload({ snapshot: snapshotWithRosterSize({ count: 65 }) });

    expect(checkSnapshotShape({ payload: atCap })).toEqual(OK);
    expect(checkSnapshotShape({ payload: overCap })).toEqual(OVER);
  });

  it("caps the waiver list at 10 pages", () => {
    const pages = ({ count }: { count: number }) =>
      Array.from({ length: count }, () => waivers106344);

    expect(
      checkSnapshotShape({ payload: gameOfCourtsPayload({ waiverPages: pages({ count: 10 }) }) }),
    ).toEqual(OK);
    expect(
      checkSnapshotShape({ payload: gameOfCourtsPayload({ waiverPages: pages({ count: 11 }) }) }),
    ).toEqual(OVER);
  });

  it("caps each waiver page at 25 players", () => {
    const atCap = gameOfCourtsPayload({
      waiverPages: [waivers106344, waiverPageWithPlayers({ count: 25 })],
    });
    const overCap = gameOfCourtsPayload({
      waiverPages: [waivers106344, waiverPageWithPlayers({ count: 26 })],
    });

    expect(checkSnapshotShape({ payload: atCap })).toEqual(OK);
    expect(checkSnapshotShape({ payload: overCap })).toEqual(OVER);
  });

  it("counts a missing or non-array collection as empty and leaves it to the parse", () => {
    const odd: unknown[] = [
      null,
      "snapshot",
      [],
      {},
      { fantasy_content: null },
      { fantasy_content: { league: { teams: { length: 99 } } } },
      { fantasy_content: { league: { teams: [null, 7, { team: { roster: "x" } }] } } },
      { fantasy_content: { league: { teams: [{ team: { roster: { players: {} } } }] } } },
    ];
    const oddPages: unknown[] = [
      null,
      7,
      { fantasy_content: { league: {} } },
      { fantasy_content: { league: { players: { length: 99 } } } },
    ];

    odd.forEach((snapshot) => {
      expect(checkSnapshotShape({ payload: gameOfCourtsPayload({ snapshot }) })).toEqual(OK);
    });
    expect(checkSnapshotShape({ payload: gameOfCourtsPayload({ waiverPages: oddPages }) })).toEqual(
      OK,
    );
  });
});
