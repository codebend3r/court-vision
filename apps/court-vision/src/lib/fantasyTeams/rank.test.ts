import { describe, expect, it } from "bun:test";

import { buildSlots, DEFAULT_SLOT_COUNTS } from "@vision/sport-basketball/engine";

import { rankRoster } from "@/lib/fantasyTeams/rank";
import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

type PlayerProps = { playerId: number; fullName: string };

const player = ({ playerId, fullName }: PlayerProps): FantasyTeamPlayer => ({
  playerId,
  firstName: fullName.split(" ")[0] ?? fullName,
  lastName: fullName.split(" ").slice(1).join(" "),
  fullName,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
});

// Brunson starting, Towns on the bench, Hart on IL, every other slot empty.
const slots = buildSlots<FantasyTeamPlayer>({ counts: DEFAULT_SLOT_COUNTS });
const benchId = slots.find((slot) => slot.type === "BENCH")?.id;
const ilId = slots.find((slot) => slot.type === "IL")?.id;

const team: FantasyTeam = {
  id: "d",
  name: "Deep",
  slug: "deep",
  logoUrl: null,
  managerName: null,
  isMine: true,
  isImported: false,
  unmatchedBySlotId: {},
  createdAt: "2026-07-25T00:00:00.000Z",
  slots: slots.map((slot) => {
    if (slot.id === "PG-1")
      return { ...slot, player: player({ playerId: 1, fullName: "Jalen Brunson" }) };
    if (slot.id === benchId) {
      return { ...slot, player: player({ playerId: 2, fullName: "Karl-Anthony Towns" }) };
    }
    if (slot.id === ilId)
      return { ...slot, player: player({ playerId: 3, fullName: "Josh Hart" }) };
    return slot;
  }),
};

describe("rankRoster", () => {
  it("lists every rostered player, bench and IL included, highest value first", () => {
    const values = new Map([
      [1, 2.5],
      [2, 6.1],
    ]);

    expect(
      rankRoster({ team, values }).map(({ player: { fullName }, value }) => [fullName, value]),
    ).toEqual([
      ["Karl-Anthony Towns", 6.1],
      ["Jalen Brunson", 2.5],
      ["Josh Hart", null],
    ]);
  });

  it("labels each player with the slot they fill", () => {
    const labels = rankRoster({ team, values: new Map() }).map(({ slotLabel }) => slotLabel);
    expect(labels).toHaveLength(3);
    expect(labels).toContain("PG");
  });

  it("orders unvalued players by name", () => {
    expect(
      rankRoster({ team, values: new Map() }).map(({ player: { fullName } }) => fullName),
    ).toEqual(["Jalen Brunson", "Josh Hart", "Karl-Anthony Towns"]);
  });
});
