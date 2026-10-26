import { describe, expect, it } from "bun:test";

import { featuredTeam } from "@/lib/fantasyTeams/featured";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

type TeamProps = {
  id: string;
  createdAt: string;
  isMine?: boolean;
  isImported?: boolean;
};

const team = ({ id, createdAt, isMine = false, isImported = false }: TeamProps): FantasyTeam => ({
  id,
  name: id,
  slug: id,
  logoUrl: null,
  managerName: null,
  isMine,
  isImported,
  unmatchedBySlotId: {},
  createdAt,
  slots: [],
});

describe("featuredTeam", () => {
  it("picks the most recently created team whatever order the list is in", () => {
    const oldest = team({ id: "oldest", createdAt: "2026-07-20T00:00:00.000Z" });
    const newest = team({ id: "newest", createdAt: "2026-07-25T00:00:00.000Z" });
    const middle = team({ id: "middle", createdAt: "2026-07-22T00:00:00.000Z" });

    expect(featuredTeam({ teams: [oldest, newest, middle] })).toBe(newest);
    expect(featuredTeam({ teams: [newest, middle, oldest] })).toBe(newest);
  });

  it("features my team in an imported league, even when a league-mate's is newer", () => {
    const mine = team({
      id: "mine",
      createdAt: "2026-07-20T00:00:00.000Z",
      isMine: true,
      isImported: true,
    });
    const rival = team({ id: "rival", createdAt: "2026-07-25T00:00:00.000Z", isImported: true });

    expect(featuredTeam({ teams: [rival, mine] })).toBe(mine);
  });

  it("features nothing in an imported league without my team", () => {
    const rival = team({ id: "rival", createdAt: "2026-07-25T00:00:00.000Z", isImported: true });
    const other = team({ id: "other", createdAt: "2026-07-22T00:00:00.000Z", isImported: true });

    expect(featuredTeam({ teams: [rival, other] })).toBeNull();
  });

  it("returns null without teams", () => {
    expect(featuredTeam({ teams: [] })).toBeNull();
  });
});
