import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type Logger } from "@vision/core/util/logger";
import { type Category } from "@vision/sport-basketball/types";

import { type YahooLoadResult } from "@/lib/yahoo/load";
import { type ImportedLeague, type ImportedTeam, type YahooPlayerRef } from "@/lib/yahoo/types";

const loadYahooLeague = vi.fn();
const readCurrentGameUncached = vi.fn();
const resolveYahooPlayers = vi.fn();

vi.mock("@/lib/yahoo/load", () => ({ loadYahooLeague, readCurrentGameUncached }));
vi.mock("@/lib/yahoo/matchPlayers", () => ({ resolveYahooPlayers }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { probeYahooLeague } = await import("@/lib/yahoo/probe");

const NINE: Category[] = ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"];

type RefProps = { id: string; name: string };

const ref = ({ id, name }: RefProps): YahooPlayerRef => ({
  yahooPlayerId: id,
  fullName: name,
  teamAbbr: "MEM",
  eligiblePositions: ["PF"],
  displayPosition: null,
  status: null,
});

type TeamProps = {
  name: string;
  managerName: string | null;
  players: YahooPlayerRef[];
};

const team = ({ name, managerName, players }: TeamProps): ImportedTeam => ({
  externalKey: `478.l.106344.t.${name}`,
  name,
  logoUrl: null,
  managerName,
  isOwnedByCurrentLogin: false,
  slots: [
    ...players.map((player) => ({ slotType: "UTIL" as const, player })),
    { slotType: "BENCH" as const, player: null },
  ],
});

const stewart = ref({ id: "6408", name: "Isaiah Stewart" });
const brunson = ref({ id: "1", name: "Jalen Brunson" });
const mystery = ref({ id: "2", name: "Mystery Man" });

const league: ImportedLeague = {
  statCategories: [],
  matchups: null,
  externalKey: "478.l.106344",
  externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
  name: "Game of Courts",
  logoUrl: null,
  season: 2026,
  teamCount: 12,
  rosterSlots: 13,
  scoring: {
    scoringType: "h2h_categories",
    scoringConfig: { categories: NINE },
    unsupportedCategories: ["Double Doubles"],
  },
  teams: [
    team({ name: "Alpha", managerName: "Sam", players: [brunson, stewart] }),
    team({ name: "Beta", managerName: null, players: [mystery] }),
  ],
};

const okResult: YahooLoadResult = { status: "ok", league, waiverRefs: [stewart] };

type LinesProps = { logger: ReturnType<typeof vi.fn<Logger>> };

const lines = ({ logger }: LinesProps): string[] => logger.mock.calls.map(([message]) => message);

describe("probeYahooLeague", () => {
  beforeEach(() => {
    loadYahooLeague.mockReset().mockResolvedValue(okResult);
    resolveYahooPlayers.mockReset().mockResolvedValue({
      byYahooId: new Map([
        ["6408", 10],
        ["1", 11],
      ]),
      unmatched: [mystery],
    });
    process.exitCode = 0;
  });

  // Bun keeps an assigned `undefined` as the previous code, so reset to 0:
  // a leaked 1 would fail the whole test run.
  afterEach(() => {
    process.exitCode = 0;
  });

  it("prints the league name with its meta, then one line per team with its roster count", async () => {
    const logger = vi.fn<Logger>();

    await probeYahooLeague({
      input: "https://basketball.fantasysports.yahoo.com/nba/106344",
      logger,
    });

    const printed = lines({ logger });
    expect(printed).toContain("Game of Courts · 12-team · 9-cat");
    expect(printed).toContain("  Alpha (Sam): 2 players");
    expect(printed).toContain("  Beta (manager hidden): 1 player");
    expect(process.exitCode).toBe(0);
  });

  it("lists the categories it could not map", async () => {
    const logger = vi.fn<Logger>();

    await probeYahooLeague({ input: "106344", logger });

    expect(lines({ logger })).toContain("Unsupported categories: Double Doubles");
  });

  it("reports how many distinct Yahoo players matched and names the rest", async () => {
    const logger = vi.fn<Logger>();

    await probeYahooLeague({ input: "106344", logger });

    expect(lines({ logger })).toContain("matched 2 of 3; unmatched: Mystery Man");
  });

  it("resolves every rostered and waiver player without writing mappings", async () => {
    await probeYahooLeague({ input: "106344", logger: vi.fn<Logger>() });

    expect(resolveYahooPlayers).toHaveBeenCalledTimes(1);
    expect(resolveYahooPlayers).toHaveBeenCalledWith({
      refs: [brunson, stewart, mystery, stewart],
      writeMappings: false,
    });
  });

  it("loads with the uncached game read and the parsed league id", async () => {
    await probeYahooLeague({ input: "106344", logger: vi.fn<Logger>() });

    expect(loadYahooLeague).toHaveBeenCalledWith({
      leagueId: "106344",
      readGame: readCurrentGameUncached,
      logger: expect.any(Function),
    });
  });

  it("says none unmatched when every player matched", async () => {
    resolveYahooPlayers.mockResolvedValue({ byYahooId: new Map(), unmatched: [] });
    loadYahooLeague.mockResolvedValue({
      status: "ok",
      league: { ...league, teams: [] },
      waiverRefs: [],
    });
    const logger = vi.fn<Logger>();

    await probeYahooLeague({ input: "106344", logger });

    expect(lines({ logger })).toContain("matched 0 of 0; unmatched: none");
  });

  it("prints the parse status and sets a failing exit code for a bad URL", async () => {
    const logger = vi.fn<Logger>();

    await probeYahooLeague({ input: "https://example.com/nope", logger });

    expect(lines({ logger })).toEqual([
      'Cannot read a league from "https://example.com/nope": invalid',
    ]);
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("prints the load status and sets a failing exit code when Yahoo refuses", async () => {
    loadYahooLeague.mockResolvedValue({ status: "not_found" });
    const logger = vi.fn<Logger>();

    await probeYahooLeague({ input: "106344", logger });

    expect(lines({ logger })).toEqual(["Yahoo load failed: not_found"]);
    expect(resolveYahooPlayers).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
