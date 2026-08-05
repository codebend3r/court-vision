import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { restoreEnv, stubEnv } from "@/lib/testing/env";

const getHeader = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => getHeader(name) }),
}));

import { confirmationRedirectTo } from "./confirmationRedirect";

describe("confirmationRedirectTo", () => {
  beforeEach(() => {
    getHeader.mockReset();
    getHeader.mockReturnValue(null);
    ["NEXT_PUBLIC_SITE_URL", "DEPLOY_PRIME_URL", "URL"].forEach((key) =>
      stubEnv({ key, value: "" }),
    );
  });

  afterEach(() => {
    restoreEnv();
  });

  it("targets the confirm route on the configured deployment origin", async () => {
    stubEnv({ key: "URL", value: "https://court-vizion.netlify.app" });
    expect(await confirmationRedirectTo()).toBe("https://court-vizion.netlify.app/auth/confirm");
  });

  it("falls back to the origin the request arrived on", async () => {
    getHeader.mockImplementation((name: string) =>
      name === "origin" ? "http://localhost:46644" : null,
    );
    expect(await confirmationRedirectTo()).toBe("http://localhost:46644/auth/confirm");
  });

  it("ignores the request origin when a deployment URL is configured", async () => {
    stubEnv({ key: "NEXT_PUBLIC_SITE_URL", value: "https://court-vizion.netlify.app" });
    getHeader.mockReturnValue("https://attacker.example");
    expect(await confirmationRedirectTo()).toBe("https://court-vizion.netlify.app/auth/confirm");
  });
});
