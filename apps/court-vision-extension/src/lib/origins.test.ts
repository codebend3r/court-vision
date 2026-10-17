import { describe, expect, it } from "bun:test";

import { COURT_VISION_DEV_ORIGIN, COURT_VISION_ORIGIN } from "@vision/yahoo-bridge/constants";

import { allowedOrigins, importPageUrl } from "@/lib/origins";

describe("allowedOrigins", () => {
  it("allows only Court Vision's production origin in a production build", () => {
    expect(allowedOrigins({ isDev: false })).toEqual([COURT_VISION_ORIGIN]);
  });

  it("adds the local dev server in a development build", () => {
    expect(allowedOrigins({ isDev: true })).toEqual([COURT_VISION_ORIGIN, COURT_VISION_DEV_ORIGIN]);
  });
});

describe("importPageUrl", () => {
  it("opens the production import page in a production build", () => {
    expect(importPageUrl({ isDev: false })).toBe("https://court-vizion.netlify.app/leagues/import");
  });

  it("opens the local import page in a development build", () => {
    expect(importPageUrl({ isDev: true })).toBe("http://localhost:46644/leagues/import");
  });
});
