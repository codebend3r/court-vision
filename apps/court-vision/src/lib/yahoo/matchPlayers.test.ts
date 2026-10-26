import { beforeEach, describe, expect, it, vi } from "bun:test";

const playerFindMany = vi.fn();
const mappingFindMany = vi.fn();
const upsert = vi.fn();
const deleteMany = vi.fn();
const $transaction = vi.fn();
// Every array handed to $transaction, so a test can assert the write order.
const transactions: unknown[][] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: { findMany: playerFindMany },
    playerExternalId: { findMany: mappingFindMany, upsert, deleteMany },
    $transaction,
  },
}));

import { type YahooPlayerRef } from "@/lib/yahoo/types";

import { isMatchMethod, matchPlayer, resolveYahooPlayers } from "@/lib/yahoo/matchPlayers";

const ref = (overrides: Partial<YahooPlayerRef> = {}): YahooPlayerRef => ({
  yahooPlayerId: "6404",
  fullName: "Jalen Green",
  teamAbbr: "PHX",
  eligiblePositions: ["SG", "G", "Util"],
  displayPosition: null,
  status: null,
  ...overrides,
});

const green = { id: 1, fullName: "Jalen Green", teamAbbr: "PHX" };
const smith = { id: 2, fullName: "Jalen Smith", teamAbbr: "CHI" };

describe("isMatchMethod", () => {
  it("accepts the three methods the matcher writes", () => {
    expect(isMatchMethod("name_team")).toBe(true);
    expect(isMatchMethod("name_only")).toBe(true);
    expect(isMatchMethod("short_name_team")).toBe(true);
  });

  it("rejects anything else, including the read-only existing marker", () => {
    expect(isMatchMethod("existing")).toBe(false);
    expect(isMatchMethod("")).toBe(false);
    expect(isMatchMethod("manual")).toBe(false);
  });
});

describe("matchPlayer", () => {
  it("keeps a stored mapping whose name still agrees", () => {
    const outcome = matchPlayer({
      ref: ref(),
      candidates: [],
      existing: { id: 9, fullName: "Jalen Green", teamAbbr: "HOU" },
    });

    expect(outcome).toEqual({ status: "matched", playerId: 9, method: "existing" });
  });

  it("drops a stored mapping whose name no longer agrees and rematches", () => {
    const outcome = matchPlayer({ ref: ref(), candidates: [green, smith], existing: smith });

    expect(outcome).toEqual({ status: "matched", playerId: 1, method: "name_team" });
  });

  it("matches on name and team", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Jalen Williams", teamAbbr: "OKC" }),
      candidates: [
        { id: 3, fullName: "Jalen Williams", teamAbbr: "OKC" },
        { id: 4, fullName: "Jalen Williams", teamAbbr: "CHA" },
      ],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 3, method: "name_team" });
  });

  it("matches on name alone when exactly one active player has it", () => {
    const outcome = matchPlayer({
      ref: ref({ teamAbbr: "SAS" }),
      candidates: [green, smith],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 1, method: "name_only" });
  });

  it("matches on name alone when Yahoo sends no team", () => {
    const outcome = matchPlayer({
      ref: ref({ teamAbbr: null }),
      candidates: [green],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 1, method: "name_only" });
  });

  it("leaves ambiguous names unmatched", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Jalen Williams", teamAbbr: "SAS" }),
      candidates: [
        { id: 3, fullName: "Jalen Williams", teamAbbr: "OKC" },
        { id: 4, fullName: "Jalen Williams", teamAbbr: "CHA" },
      ],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("leaves a name unmatched when two players share both name and team", () => {
    const outcome = matchPlayer({
      ref: ref(),
      candidates: [green, { id: 5, fullName: "Jalen Green", teamAbbr: "PHX" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("leaves a name nobody has unmatched", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Nobody Here" }),
      candidates: [green],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("matches accented names", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Egor Dëmin", teamAbbr: "BKN" }),
      candidates: [{ id: 8, fullName: "Egor Demin", teamAbbr: "BKN" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 8, method: "name_team" });
  });

  it("ignores a generational suffix on Yahoo's side", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Jimmy Butler III", teamAbbr: "GSW" }),
      candidates: [{ id: 79, fullName: "Jimmy Butler", teamAbbr: "GSW" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 79, method: "name_team" });
  });

  it("ignores a generational suffix on our side", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Jaime Jaquez", teamAbbr: "MIA" }),
      candidates: [{ id: 12, fullName: "Jaime Jaquez Jr.", teamAbbr: "MIA" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 12, method: "name_team" });
  });

  it("prefers the exact name over one that differs only by a suffix", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Gary Payton II", teamAbbr: "GSW" }),
      candidates: [
        { id: 10, fullName: "Gary Payton", teamAbbr: "GSW" },
        { id: 11, fullName: "Gary Payton II", teamAbbr: "GSW" },
      ],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 11, method: "name_team" });
  });

  it("keeps a word that only looks like a suffix in a two-word name", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Jalen V", teamAbbr: "PHX" }),
      candidates: [{ id: 19, fullName: "Jalen", teamAbbr: "PHX" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("matches a shortened first name on last name and team", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Nic Claxton", teamAbbr: "BKN" }),
      candidates: [{ id: 13, fullName: "Nicolas Claxton", teamAbbr: "BKN" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 13, method: "short_name_team" });
  });

  it("matches a shortened first name on either side", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Alexandre Sarr", teamAbbr: "WAS" }),
      candidates: [{ id: 14, fullName: "Alex Sarr", teamAbbr: "WAS" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "matched", playerId: 14, method: "short_name_team" });
  });

  it("never matches a shortened first name on another team", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Nic Claxton", teamAbbr: "BKN" }),
      candidates: [{ id: 13, fullName: "Nicolas Claxton", teamAbbr: "HOU" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("never matches a shortened first name when Yahoo sends no team", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Nic Claxton", teamAbbr: null }),
      candidates: [{ id: 13, fullName: "Nicolas Claxton", teamAbbr: null }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("never matches teammates whose first names only share an initial", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Jalen Williams", teamAbbr: "OKC" }),
      candidates: [{ id: 15, fullName: "Jaylin Williams", teamAbbr: "OKC" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("never matches a one-letter first name as a shortened one", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "J Williams", teamAbbr: "OKC" }),
      candidates: [{ id: 15, fullName: "Jaylin Williams", teamAbbr: "OKC" }],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("leaves a shortened first name unmatched when it fits two teammates", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Cam Johnson", teamAbbr: "DEN" }),
      candidates: [
        { id: 16, fullName: "Cameron Johnson", teamAbbr: "DEN" },
        { id: 17, fullName: "Camden Johnson", teamAbbr: "DEN" },
      ],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("never falls back to a shortened name when the full name is ambiguous", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Jalen Williams", teamAbbr: "SAS" }),
      candidates: [
        { id: 3, fullName: "Jalen Williams", teamAbbr: "OKC" },
        { id: 4, fullName: "Jalen Williams", teamAbbr: "CHA" },
        { id: 18, fullName: "Jalenius Williams", teamAbbr: "SAS" },
      ],
      existing: null,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });

  it("keeps a stored mapping made through a shortened first name", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Nic Claxton", teamAbbr: "HOU" }),
      candidates: [],
      existing: { id: 13, fullName: "Nicolas Claxton", teamAbbr: "BKN" },
    });

    expect(outcome).toEqual({ status: "matched", playerId: 13, method: "existing" });
  });

  it("keeps a stored mapping whose names differ only by a suffix", () => {
    const outcome = matchPlayer({
      ref: ref({ fullName: "Jimmy Butler III", teamAbbr: "GSW" }),
      candidates: [],
      existing: { id: 79, fullName: "Jimmy Butler", teamAbbr: "GSW" },
    });

    expect(outcome).toEqual({ status: "matched", playerId: 79, method: "existing" });
  });

  it("matches a nickname Balldontlie spells with the legal first name", () => {
    const airious = { id: 9, fullName: "Airious Bailey", teamAbbr: "UTA" };
    expect(
      matchPlayer({
        ref: ref({ fullName: "Ace Bailey", teamAbbr: "UTA" }),
        candidates: [airious],
        existing: null,
      }),
    ).toEqual({ status: "matched", playerId: 9, method: "name_team" });
  });

  it("matches a known nickname without Yahoo's team", () => {
    const carlton = { id: 7, fullName: "Carlton Carrington", teamAbbr: "WAS" };
    expect(
      matchPlayer({
        ref: ref({ fullName: "Bub Carrington", teamAbbr: null }),
        candidates: [carlton],
        existing: null,
      }),
    ).toEqual({ status: "matched", playerId: 7, method: "name_only" });
  });

  it("never applies an alias to another player with the same last name", () => {
    const amari = { id: 5, fullName: "Amari Bailey", teamAbbr: "BKN" };
    expect(
      matchPlayer({
        ref: ref({ fullName: "Ace Bailey", teamAbbr: "UTA" }),
        candidates: [amari],
        existing: null,
      }),
    ).toEqual({ status: "unmatched" });
  });

  it("never matches a ref whose name has an empty key", () => {
    const blankCandidate = { id: 6, fullName: "...", teamAbbr: "PHX" };

    const outcome = matchPlayer({
      ref: ref({ fullName: "..." }),
      candidates: [blankCandidate],
      existing: blankCandidate,
    });

    expect(outcome).toEqual({ status: "unmatched" });
  });
});

describe("resolveYahooPlayers", () => {
  beforeEach(() => {
    playerFindMany.mockReset();
    mappingFindMany.mockReset();
    upsert.mockReset();
    deleteMany.mockReset();
    $transaction.mockReset();
    transactions.length = 0;

    playerFindMany.mockResolvedValue([green, smith]);
    mappingFindMany.mockResolvedValue([]);
    upsert.mockImplementation((args: unknown) => ({ op: "upsert", args }));
    deleteMany.mockImplementation((args: unknown) => ({ op: "deleteMany", args }));
    $transaction.mockImplementation((ops: unknown[]) => {
      transactions.push(ops);
      return Promise.resolve(ops);
    });
  });

  it("queries only active players and the stored mappings for the given refs", async () => {
    await resolveYahooPlayers({ refs: [ref()], writeMappings: false });

    expect(playerFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, fullName: true, teamAbbr: true },
    });
    expect(mappingFindMany).toHaveBeenCalledWith({
      where: { provider: "yahoo", externalId: { in: ["6404"] } },
      include: { player: { select: { id: true, fullName: true, teamAbbr: true } } },
    });
  });

  it("maps matched refs and lists the rest as unmatched", async () => {
    const missing = ref({ yahooPlayerId: "1", fullName: "Nobody Here" });

    const resolved = await resolveYahooPlayers({ refs: [ref(), missing], writeMappings: false });

    expect([...resolved.byYahooId]).toEqual([["6404", 1]]);
    expect(resolved.unmatched).toEqual([missing]);
  });

  it("finds candidates whose full name differs from Yahoo's", async () => {
    playerFindMany.mockResolvedValue([
      green,
      { id: 79, fullName: "Jimmy Butler", teamAbbr: "GSW" },
      { id: 13, fullName: "Nicolas Claxton", teamAbbr: "BKN" },
    ]);
    const butler = ref({ yahooPlayerId: "5", fullName: "Jimmy Butler III", teamAbbr: "GSW" });
    const claxton = ref({ yahooPlayerId: "6", fullName: "Nic Claxton", teamAbbr: "BKN" });

    const resolved = await resolveYahooPlayers({
      refs: [butler, claxton],
      writeMappings: true,
    });

    expect([...resolved.byYahooId]).toEqual([
      ["5", 79],
      ["6", 13],
    ]);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ externalId: "6", method: "short_name_team" }),
      }),
    );
  });

  describe("a player no active roster lists", () => {
    const porter = ref({ yahooPlayerId: "5000", fullName: "Kevin Porter Jr.", teamAbbr: "MIL" });
    const inactivePorter = { id: 666849, fullName: "Kevin Porter Jr.", teamAbbr: "MIL" };

    it("matches an inactive player of exactly that name", async () => {
      playerFindMany.mockResolvedValueOnce([green, smith]).mockResolvedValueOnce([inactivePorter]);

      const resolved = await resolveYahooPlayers({ refs: [porter], writeMappings: false });

      expect([...resolved.byYahooId]).toEqual([["5000", 666849]]);
      expect(resolved.unmatched).toEqual([]);
    });

    it("asks only for the unmatched refs, by name, among inactive players", async () => {
      playerFindMany.mockResolvedValueOnce([green, smith]).mockResolvedValueOnce([inactivePorter]);

      await resolveYahooPlayers({ refs: [ref(), porter], writeMappings: false });

      expect(playerFindMany).toHaveBeenCalledTimes(2);
      expect(playerFindMany).toHaveBeenLastCalledWith({
        where: {
          isActive: false,
          OR: [{ fullName: { equals: "Kevin Porter Jr.", mode: "insensitive" } }],
        },
        select: { id: true, fullName: true, teamAbbr: true },
      });
    });

    it("asks nothing more when every ref matched an active player", async () => {
      await resolveYahooPlayers({ refs: [ref()], writeMappings: false });
      expect(playerFindMany).toHaveBeenCalledTimes(1);
    });

    it("prefers an active player of the name over an inactive one", async () => {
      const activePorter = { id: 1, fullName: "Kevin Porter Jr.", teamAbbr: "MIL" };
      playerFindMany.mockResolvedValueOnce([activePorter]);

      const resolved = await resolveYahooPlayers({ refs: [porter], writeMappings: false });

      expect([...resolved.byYahooId]).toEqual([["5000", 1]]);
      expect(playerFindMany).toHaveBeenCalledTimes(1);
    });

    it("leaves a name unmatched when two inactive players share it", async () => {
      playerFindMany
        .mockResolvedValueOnce([green])
        .mockResolvedValueOnce([
          inactivePorter,
          { id: 2273, fullName: "Kevin Porter Jr.", teamAbbr: "WAS" },
        ]);

      const resolved = await resolveYahooPlayers({
        refs: [ref({ yahooPlayerId: "5000", fullName: "Kevin Porter Jr.", teamAbbr: null })],
        writeMappings: false,
      });

      expect(resolved.byYahooId.size).toBe(0);
    });

    it("never gives one inactive player to two Yahoo ids", async () => {
      const twin = ref({ yahooPlayerId: "5001", fullName: "Kevin Porter Jr.", teamAbbr: "MIL" });
      playerFindMany.mockResolvedValueOnce([green]).mockResolvedValueOnce([inactivePorter]);

      const resolved = await resolveYahooPlayers({ refs: [porter, twin], writeMappings: false });

      expect(resolved.byYahooId.size).toBe(0);
    });
  });

  it("resolves a ref listed twice once", async () => {
    const resolved = await resolveYahooPlayers({ refs: [ref(), ref()], writeMappings: false });

    expect([...resolved.byYahooId]).toEqual([["6404", 1]]);
    expect(resolved.unmatched).toEqual([]);
  });

  it("never maps two Yahoo players to one Court Vision player", async () => {
    const first = ref({ yahooPlayerId: "6404" });
    const second = ref({ yahooPlayerId: "7777", teamAbbr: "SAS" });

    const resolved = await resolveYahooPlayers({ refs: [first, second], writeMappings: false });

    expect(resolved.byYahooId.size).toBe(0);
    expect(resolved.unmatched).toEqual([first, second]);
  });

  it("keeps a stored mapping whose name still agrees", async () => {
    mappingFindMany.mockResolvedValueOnce([
      {
        externalId: "6404",
        playerId: 9,
        method: "name_only",
        eligiblePositions: ["SG", "G"],
        player: { id: 9, fullName: "Jalen Green", teamAbbr: "HOU" },
      },
    ]);

    const resolved = await resolveYahooPlayers({ refs: [ref()], writeMappings: true });

    expect(resolved.byYahooId.get("6404")).toBe(9);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith({
      where: { provider_externalId: { provider: "yahoo", externalId: "6404" } },
      create: {
        provider: "yahoo",
        externalId: "6404",
        playerId: 9,
        method: "name_only",
        eligiblePositions: ["SG", "G", "Util"],
      },
      update: { playerId: 9, method: "name_only", eligiblePositions: ["SG", "G", "Util"] },
    });
  });

  it("drops a stored mapping whose name no longer agrees and rematches", async () => {
    mappingFindMany.mockResolvedValueOnce([
      {
        externalId: "6404",
        playerId: 2,
        method: "name_team",
        eligiblePositions: [],
        player: smith,
      },
    ]);

    const resolved = await resolveYahooPlayers({ refs: [ref()], writeMappings: true });

    expect(resolved.byYahooId.get("6404")).toBe(1);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { provider: "yahoo", externalId: { in: ["6404"] } },
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { provider_externalId: { provider: "yahoo", externalId: "6404" } },
      create: {
        provider: "yahoo",
        externalId: "6404",
        playerId: 1,
        method: "name_team",
        eligiblePositions: ["SG", "G", "Util"],
      },
      update: { playerId: 1, method: "name_team", eligiblePositions: ["SG", "G", "Util"] },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual([
      {
        op: "deleteMany",
        args: { where: { provider: "yahoo", externalId: { in: ["6404"] } } },
      },
      expect.objectContaining({ op: "upsert" }),
    ]);
  });

  it("deletes a stale mapping whose ref no longer matches anyone", async () => {
    mappingFindMany.mockResolvedValueOnce([
      {
        externalId: "6404",
        playerId: 2,
        method: "name_team",
        eligiblePositions: [],
        player: smith,
      },
    ]);
    playerFindMany.mockResolvedValue([smith]);

    const resolved = await resolveYahooPlayers({ refs: [ref()], writeMappings: true });

    expect(resolved.byYahooId.size).toBe(0);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("writes nothing when writeMappings is false", async () => {
    mappingFindMany.mockResolvedValueOnce([
      {
        externalId: "6404",
        playerId: 2,
        method: "name_team",
        eligiblePositions: [],
        player: smith,
      },
    ]);

    const resolved = await resolveYahooPlayers({ refs: [ref()], writeMappings: false });

    expect(resolved.byYahooId.get("6404")).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it("skips the upsert for a stored mapping that is unchanged", async () => {
    mappingFindMany.mockResolvedValueOnce([
      {
        externalId: "6404",
        playerId: 1,
        method: "name_team",
        eligiblePositions: ["SG", "G", "Util"],
        player: green,
      },
    ]);

    const resolved = await resolveYahooPlayers({ refs: [ref()], writeMappings: true });

    expect(resolved.byYahooId.get("6404")).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it("refreshes eligible positions on stored mappings", async () => {
    mappingFindMany.mockResolvedValueOnce([
      {
        externalId: "6404",
        playerId: 1,
        method: "name_team",
        eligiblePositions: ["SG", "G", "Util"],
        player: green,
      },
    ]);

    await resolveYahooPlayers({
      refs: [ref({ eligiblePositions: ["SF", "F"] })],
      writeMappings: true,
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { playerId: 1, method: "name_team", eligiblePositions: ["SF", "F"] },
      }),
    );
  });

  it("never upserts conflicted refs when writing", async () => {
    const first = ref({ yahooPlayerId: "6404" });
    const second = ref({ yahooPlayerId: "7777", teamAbbr: "SAS" });

    const resolved = await resolveYahooPlayers({ refs: [first, second], writeMappings: true });

    expect(resolved.byYahooId.size).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it("keeps a stored row whose name agrees when its ref loses a conflict", async () => {
    mappingFindMany.mockResolvedValueOnce([
      {
        externalId: "6404",
        playerId: 1,
        method: "name_team",
        eligiblePositions: [],
        player: green,
      },
    ]);
    const stored = ref({ yahooPlayerId: "6404" });
    const rival = ref({ yahooPlayerId: "7777", teamAbbr: "SAS" });

    const resolved = await resolveYahooPlayers({ refs: [stored, rival], writeMappings: true });

    expect(resolved.byYahooId.size).toBe(0);
    expect(resolved.unmatched).toEqual([stored, rival]);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("leaves a ref unmatched when another Yahoo id outside the batch already holds the player", async () => {
    mappingFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ playerId: 1 }]);
    const rival = ref({ yahooPlayerId: "7777" });

    const resolved = await resolveYahooPlayers({ refs: [rival], writeMappings: true });

    expect(mappingFindMany).toHaveBeenLastCalledWith({
      where: { provider: "yahoo", playerId: { in: [1] }, externalId: { notIn: ["7777"] } },
      select: { playerId: true },
    });
    expect(resolved.byYahooId.size).toBe(0);
    expect(resolved.unmatched).toEqual([rival]);
    expect(upsert).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it("skips the held-player query when nothing matched", async () => {
    await resolveYahooPlayers({ refs: [ref({ fullName: "Nobody Here" })], writeMappings: true });

    expect(mappingFindMany).toHaveBeenCalledTimes(1);
  });

  it("ignores a stored row whose method this code never writes", async () => {
    mappingFindMany.mockResolvedValueOnce([
      {
        externalId: "6404",
        playerId: 9,
        method: "manual",
        player: { id: 9, fullName: "Jalen Green", teamAbbr: "HOU" },
      },
    ]);

    const resolved = await resolveYahooPlayers({ refs: [ref()], writeMappings: false });

    expect(resolved.byYahooId.get("6404")).toBe(1);
  });

  it("opens no transaction when there is nothing to write", async () => {
    await resolveYahooPlayers({ refs: [ref({ fullName: "Nobody Here" })], writeMappings: true });

    expect($transaction).not.toHaveBeenCalled();
  });
});
