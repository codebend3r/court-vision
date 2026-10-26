import { describe, expect, it } from "bun:test";

import { type Category, type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

import { makeStatLine, type FixtureOverrides } from "@/lib/valuation/fixtures";
import { type FantasyStatLine } from "@/lib/valuation/types";
import {
  buildHeadToHead,
  headToHeadSummary,
  resolvePair,
  type HeadToHeadPair,
} from "@/lib/waiverWire/headToHead";
import { type WaiverModel, type WaiverRow } from "@/lib/waiverWire/types";

type RowProps = {
  playerId: number;
  value?: number;
  owner?: WaiverRow["owner"];
  fullName?: string;
};

const row = ({
  playerId,
  value = 0,
  owner = "free_agent",
  fullName = `Test Player ${playerId}`,
}: RowProps): WaiverRow => ({
  playerId,
  fullName,
  teamAbbr: "BOS",
  position: "G",
  nbaPersonId: null,
  value,
  rank: playerId,
  owner,
  injuryStatus: null,
});

type ModelProps = {
  roster: WaiverRow[];
  weakest?: WaiverRow[];
  freePool: WaiverRow[];
};

const model = ({
  roster,
  weakest = roster.toSorted((a, b) => a.value - b.value).slice(0, 3),
  freePool,
}: ModelProps): WaiverModel => ({ roster, noStats: [], weakest, freePool });

// A 50-game line with no shooting volume unless the overrides add some, so
// each test states only the stats it reads.
const line = (overrides: FixtureOverrides): FantasyStatLine =>
  makeStatLine({
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    fg3m: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    ftm: 0,
    fta: 0,
    ...overrides,
  });

const byId = (lines: FantasyStatLine[]): ReadonlyMap<number, FantasyStatLine> =>
  new Map(lines.map((entry) => [entry.playerId, entry]));

const LABELS: Record<Category, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  tpm: "3PM",
  tov: "TOV",
  fg: "FG%",
  ft: "FT%",
};

const KEYS: Category[] = ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"];

type EntryProps = {
  key: Category;
  z?: number;
  g?: number;
};

const entry = ({ key, z = 0, g = z }: EntryProps): FantasyCategoryBreakdown => ({
  key,
  label: LABELS[key],
  fullName: key,
  kind: key === "fg" || key === "ft" ? "ratio" : "counting",
  perGame: 0,
  z,
  g,
});

const flat = (): FantasyCategoryBreakdown[] => KEYS.map((key) => entry({ key }));

const FA = row({ playerId: 10, value: 3, fullName: "Wendell Carter Jr." });
const MINE = row({ playerId: 1, value: 1, owner: "mine" });
const PAIR: HeadToHeadPair = { fa: FA, mine: MINE };

describe("resolvePair", () => {
  const swapTop = row({ playerId: 11, value: 5 });
  const first = row({ playerId: 12, value: 6 });
  const rostered = row({ playerId: 2, value: 4, owner: "mine" });
  const weakest = row({ playerId: 3, value: 0, owner: "mine" });
  const waiverModel = model({ roster: [rostered, weakest], freePool: [first, swapTop] });

  it("picks the named players when both are still available", () => {
    const pair = resolvePair({ model: waiverModel, swapTop, fa: 12, mine: 2 });
    expect(pair?.fa.playerId).toBe(12);
    expect(pair?.mine.playerId).toBe(2);
  });

  it("falls back when the URL names someone no longer available", () => {
    const swapped = resolvePair({ model: waiverModel, swapTop, fa: 2, mine: 12 });
    expect(swapped?.fa.playerId).toBe(11);
    expect(swapped?.mine.playerId).toBe(3);

    const unnamed = resolvePair({ model: waiverModel, swapTop, fa: null, mine: null });
    expect(unnamed?.fa.playerId).toBe(11);
    expect(unnamed?.mine.playerId).toBe(3);

    const noSwapTop = resolvePair({ model: waiverModel, swapTop: null, fa: 999, mine: null });
    expect(noSwapTop?.fa.playerId).toBe(12);

    expect(
      resolvePair({ model: model({ roster: [], freePool: [first] }), swapTop, fa: 12, mine: 2 }),
    ).toBeNull();
    expect(
      resolvePair({
        model: model({ roster: [rostered], freePool: [] }),
        swapTop: null,
        fa: null,
        mine: 2,
      }),
    ).toBeNull();
  });
});

describe("buildHeadToHead", () => {
  const lines = byId([line({ playerId: 10 }), line({ playerId: 1 })]);

  it("picks each category's winner by score, with ties for neither", () => {
    type BreakdownForProps = { playerId: number };

    const breakdownFor = ({ playerId }: BreakdownForProps): FantasyCategoryBreakdown[] =>
      playerId === 10
        ? [
            entry({ key: "pts", z: 1, g: -1 }),
            entry({ key: "reb", z: -0.5, g: 2 }),
            entry({ key: "ast", z: 0.3 }),
          ]
        : [
            entry({ key: "pts", z: 0, g: 0 }),
            entry({ key: "reb", z: 0, g: 0 }),
            entry({ key: "ast", z: 0.3 }),
          ];

    const byZ = buildHeadToHead({
      pair: PAIR,
      linesById: lines,
      rosterIds: [1],
      breakdownFor,
      scoreKey: "z",
    });
    expect(byZ.rows.map((r) => r.winner)).toEqual(["fa", "mine", "tie"]);
    expect(byZ.faWins).toBe(1);
    expect(byZ.categoryCount).toBe(3);

    const byG = buildHeadToHead({
      pair: PAIR,
      linesById: lines,
      rosterIds: [1],
      breakdownFor,
      scoreKey: "g",
    });
    expect(byG.rows.map((r) => r.winner)).toEqual(["mine", "fa", "tie"]);
  });

  it("reports per-game numbers, percentages as rates", () => {
    const result = buildHeadToHead({
      pair: PAIR,
      linesById: byId([
        line({ playerId: 10, pts: 750, fgm: 280, fga: 500 }),
        line({ playerId: 1, pts: 500, fgm: 266, fga: 500 }),
      ]),
      rosterIds: [1],
      breakdownFor: flat,
      scoreKey: "z",
    });
    const pts = result.rows.find((r) => r.key === "pts");
    const fg = result.rows.find((r) => r.key === "fg");
    expect(pts?.faPerGame).toBe(15);
    expect(pts?.minePerGame).toBe(10);
    expect(fg?.faPerGame).toBeCloseTo(0.56);
    expect(fg?.minePerGame).toBeCloseTo(0.532);
    expect(fg?.label).toBe("FG%");
    expect(fg?.kind).toBe("ratio");
    expect(result.rows.map((r) => r.key)).toEqual(KEYS);
  });

  it("computes the team change from the swap", () => {
    const result = buildHeadToHead({
      pair: PAIR,
      linesById: byId([
        line({ playerId: 10, reb: 500, tov: 150 }),
        line({ playerId: 1, reb: 200, tov: 80 }),
        line({ playerId: 2, reb: 300, tov: 50 }),
      ]),
      rosterIds: [1, 2],
      breakdownFor: flat,
      scoreKey: "z",
    });
    const reb = result.rows.find((r) => r.key === "reb");
    const tov = result.rows.find((r) => r.key === "tov");
    const pts = result.rows.find((r) => r.key === "pts");
    expect(reb?.teamDelta).toBeCloseTo(6);
    expect(reb?.teamDeltaImproves).toBe(true);
    expect(tov?.teamDelta).toBeCloseTo(1.4);
    expect(tov?.teamDeltaImproves).toBe(false);
    expect(pts?.teamDelta).toBe(0);
    expect(pts?.teamDeltaImproves).toBeNull();
  });

  it("reports exactly no change when the swap is like for like", () => {
    const result = buildHeadToHead({
      pair: PAIR,
      linesById: byId([
        line({ playerId: 2, gamesPlayed: 5, stl: 6, fgm: 7, fga: 13 }),
        line({ playerId: 1, gamesPlayed: 5, stl: 2, fgm: 3, fga: 7 }),
        line({ playerId: 3, gamesPlayed: 5, stl: 11, fgm: 11, fga: 19 }),
        line({ playerId: 10, gamesPlayed: 5, stl: 2, fgm: 3, fga: 7 }),
      ]),
      rosterIds: [2, 1, 3],
      breakdownFor: flat,
      scoreKey: "z",
    });
    expect(result.rows.map((r) => r.teamDelta)).toEqual(KEYS.map(() => 0));
    expect(result.rows.map((r) => r.teamDeltaImproves)).toEqual(KEYS.map(() => null));
  });

  it("counts each roster player once and never counts the free agent as mine", () => {
    const linesById = byId([
      line({ playerId: 10, reb: 500, fgm: 300, fga: 500 }),
      line({ playerId: 1, reb: 200, fgm: 100, fga: 300 }),
      line({ playerId: 2, reb: 300, fgm: 200, fga: 450 }),
    ]);
    const build = (rosterIds: number[]) =>
      buildHeadToHead({ pair: PAIR, linesById, rosterIds, breakdownFor: flat, scoreKey: "z" });
    const clean = build([1, 2]);
    expect(build([1, 2, 2, 1])).toEqual(clean);
    expect(build([1, 10, 2])).toEqual(clean);
  });

  it("adds only the free agent's line when mine has none", () => {
    const result = buildHeadToHead({
      pair: PAIR,
      linesById: byId([line({ playerId: 10, reb: 500 }), line({ playerId: 2, reb: 300 })]),
      rosterIds: [1, 2],
      breakdownFor: flat,
      scoreKey: "z",
    });
    const reb = result.rows.find((r) => r.key === "reb");
    expect(reb?.teamDelta).toBe(10);
    expect(reb?.teamDeltaImproves).toBe(true);
    expect(reb?.minePerGame).toBe(0);
  });

  it("keeps team percentages finite with no attempts", () => {
    const result = buildHeadToHead({
      pair: PAIR,
      linesById: byId([line({ playerId: 10 }), line({ playerId: 1 }), line({ playerId: 2 })]),
      rosterIds: [1, 2, 99],
      breakdownFor: flat,
      scoreKey: "z",
    });
    const rates = result.rows.filter((r) => r.kind === "ratio");
    expect(rates.map((r) => r.key)).toEqual(["fg", "ft"]);
    rates.forEach((r) => {
      expect(Number.isFinite(r.teamDelta)).toBe(true);
      expect(r.teamDelta).toBe(0);
      expect(r.teamDeltaImproves).toBeNull();
      expect(r.faPerGame).toBe(0);
      expect(r.minePerGame).toBe(0);
    });
  });
});

describe("headToHeadSummary", () => {
  it("summarizes wins", () => {
    expect(
      headToHeadSummary({ pair: PAIR, result: { rows: [], faWins: 5, categoryCount: 9 } }),
    ).toBe("Wendell Carter Jr. wins 5 of 9");
  });
});
