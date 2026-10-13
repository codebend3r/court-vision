import { describe, expect, it } from "bun:test";

import { featuredTeam } from "@/lib/fantasyTeams/featured";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

const team = ({ id, createdAt }: { id: string; createdAt: string }): FantasyTeam => ({
  id,
  name: id,
  slug: id,
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

  it("returns null without teams", () => {
    expect(featuredTeam({ teams: [] })).toBeNull();
  });
});
