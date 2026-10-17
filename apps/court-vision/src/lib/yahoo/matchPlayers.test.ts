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
  status: null,
  ...overrides,
});

const green = { id: 1, fullName: "Jalen Green", teamAbbr: "PHX" };
const smith = { id: 2, fullName: "Jalen Smith", teamAbbr: "CHI" };

describe("isMatchMethod", () => {
  it("accepts the two methods the matcher writes", () => {
    expect(isMatchMethod("name_team")).toBe(true);
    expect(isMatchMethod("name_only")).toBe(true);
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
      { externalId: "6404", playerId: 2, method: "name_team", player: smith },
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
      { externalId: "6404", playerId: 2, method: "name_team", player: smith },
    ]);
    playerFindMany.mockResolvedValue([smith]);

    const resolved = await resolveYahooPlayers({ refs: [ref()], writeMappings: true });

    expect(resolved.byYahooId.size).toBe(0);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("writes nothing when writeMappings is false", async () => {
    mappingFindMany.mockResolvedValueOnce([
      { externalId: "6404", playerId: 2, method: "name_team", player: smith },
    ]);

    const resolved = await resolveYahooPlayers({ refs: [ref()], writeMappings: false });

    expect(resolved.byYahooId.get("6404")).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it("refreshes eligible positions on stored mappings", async () => {
    mappingFindMany.mockResolvedValueOnce([
      { externalId: "6404", playerId: 1, method: "name_team", player: green },
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
      { externalId: "6404", playerId: 1, method: "name_team", player: green },
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
