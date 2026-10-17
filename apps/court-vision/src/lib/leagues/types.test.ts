import { describe, expect, it } from "bun:test";

import {
  isLeagueProvider,
  isLeagueSyncVia,
  toLeagueProvider,
  toLeagueSyncVia,
} from "@/lib/leagues/types";

describe("isLeagueProvider", () => {
  it("accepts manual and yahoo", () => {
    expect(isLeagueProvider("manual")).toBe(true);
    expect(isLeagueProvider("yahoo")).toBe(true);
  });

  it("rejects an unknown or differently cased provider", () => {
    expect(isLeagueProvider("espn")).toBe(false);
    expect(isLeagueProvider("Yahoo")).toBe(false);
    expect(isLeagueProvider("")).toBe(false);
  });
});

describe("toLeagueProvider", () => {
  it("keeps a known provider", () => {
    expect(toLeagueProvider({ value: "yahoo" })).toBe("yahoo");
  });

  it("reads an unknown stored provider as manual", () => {
    expect(toLeagueProvider({ value: "espn" })).toBe("manual");
  });
});

describe("isLeagueSyncVia", () => {
  it("accepts server and extension", () => {
    expect(isLeagueSyncVia("server")).toBe(true);
    expect(isLeagueSyncVia("extension")).toBe(true);
  });

  it("rejects an unknown or differently cased sync path", () => {
    expect(isLeagueSyncVia("browser")).toBe(false);
    expect(isLeagueSyncVia("Extension")).toBe(false);
    expect(isLeagueSyncVia("")).toBe(false);
  });
});

describe("toLeagueSyncVia", () => {
  it("keeps a known sync path", () => {
    expect(toLeagueSyncVia({ value: "extension" })).toBe("extension");
  });

  it("reads an unknown stored sync path as server", () => {
    expect(toLeagueSyncVia({ value: "browser" })).toBe("server");
  });
});
