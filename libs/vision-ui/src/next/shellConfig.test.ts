import { describe, expect, it } from "bun:test";

import { SECURITY_HEADERS } from "#ui/next/securityHeaders";
import { shellNextConfig } from "#ui/next/shellConfig";

describe("shellNextConfig", () => {
  const config = shellNextConfig({
    appDir: "/repo/apps/rink-vision",
    sportPackage: "@vision/sport-hockey",
  });

  it("roots Turbopack and file tracing at the monorepo, two levels up", () => {
    expect(config.turbopack?.root).toBe("/repo");
    expect(config.outputFileTracingRoot).toBe("/repo");
  });

  it("compiles the core, the app's sport lib and the design system", () => {
    expect(config.transpilePackages).toEqual([
      "@vision/core",
      "@vision/sport-hockey",
      "@vision/ui",
    ]);
  });

  it("sends the shared security headers on every route", async () => {
    expect(await config.headers?.()).toEqual([
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
    ]);
  });
});
