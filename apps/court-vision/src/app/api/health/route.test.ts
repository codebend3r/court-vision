import { beforeEach, describe, expect, it, vi } from "bun:test";

const MODELS = [
  "player",
  "requestRateLimit",
  "profile",
  "league",
  "leagueTeam",
  "leagueTeamSlot",
  "leagueMatchup",
  "leagueWatchlistPlayer",
  "playerExternalId",
  "leagueWaiverPlayer",
  "playerSeasonStats",
  "playerGameLog",
  "playerAdvancedGameLog",
];

const findFirst = Object.fromEntries(MODELS.map((model) => [model, vi.fn()]));

vi.mock("@/lib/prisma", () => ({
  prisma: Object.fromEntries(MODELS.map((model) => [model, { findFirst: findFirst[model] }])),
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  Object.values(findFirst).forEach((probe) => {
    probe.mockReset();
    probe.mockResolvedValue(null);
  });
});

describe("GET /api/health", () => {
  it("answers 200 when every table reads cleanly", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", failing: [] });
  });

  it("probes every model so a missing column on any table is caught", async () => {
    await GET();
    MODELS.forEach((model) => {
      expect(findFirst[model]).toHaveBeenCalledTimes(1);
    });
  });

  it("answers 503 and names the table when its schema has drifted", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    findFirst.league.mockRejectedValue(
      new Error("The column `League.syncStartedAt` does not exist in the current database."),
    );

    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ status: "down", failing: ["league"] });
    expect(JSON.stringify(body)).not.toContain("syncStartedAt");
    consoleError.mockRestore();
  });
});
