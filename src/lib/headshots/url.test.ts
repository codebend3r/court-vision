import { describe, expect, it } from "vitest";

import { headshotUrl } from "@/lib/headshots/url";

describe("headshotUrl", () => {
  it("builds the exact NBA CDN headshot URL for a person id", () => {
    expect(headshotUrl({ nbaPersonId: 1630162 })).toBe(
      "https://cdn.nba.com/headshots/nba/latest/1040x760/1630162.png",
    );
  });
});
