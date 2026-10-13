import { afterEach, describe, expect, it } from "bun:test";

import { restoreEnv, stubEnv } from "@vision/testing/env";

import { resolveSiteOrigin } from "@/lib/siteUrl";

afterEach(() => {
  restoreEnv();
});

// Netlify injects URL and DEPLOY_PRIME_URL into every build, so a test that
// only sets the var it cares about would still read the ambient one and pass
// for the wrong reason. Blank all three, then set what the case is about.
function clearSiteEnv(): void {
  ["NEXT_PUBLIC_SITE_URL", "DEPLOY_PRIME_URL", "URL"].forEach((key) => stubEnv({ key, value: "" }));
}

// With no request origin, the configured origin is the answer whenever one is
// set, and the localhost fallback marks "nothing configured".
const FALLBACK = "http://localhost:3000";

describe("resolveSiteOrigin from the deployment variables", () => {
  it("falls back when no deployment variable is set", () => {
    clearSiteEnv();
    expect(resolveSiteOrigin()).toBe(FALLBACK);
  });

  it("lets NEXT_PUBLIC_SITE_URL win over the Netlify defaults", () => {
    clearSiteEnv();
    stubEnv({ key: "URL", value: "https://court-vizion.netlify.app" });
    stubEnv({ key: "DEPLOY_PRIME_URL", value: "https://deploy-preview-9--cv.netlify.app" });
    stubEnv({ key: "NEXT_PUBLIC_SITE_URL", value: "https://courtvision.example" });

    expect(resolveSiteOrigin()).toBe("https://courtvision.example");
  });

  it("prefers the branch deploy URL over the production URL", () => {
    clearSiteEnv();
    stubEnv({ key: "URL", value: "https://court-vizion.netlify.app" });
    stubEnv({ key: "DEPLOY_PRIME_URL", value: "https://deploy-preview-9--cv.netlify.app" });

    expect(resolveSiteOrigin()).toBe("https://deploy-preview-9--cv.netlify.app");
  });

  it("falls through a blank value to the next variable", () => {
    clearSiteEnv();
    stubEnv({ key: "NEXT_PUBLIC_SITE_URL", value: "   " });
    stubEnv({ key: "URL", value: "https://court-vizion.netlify.app" });

    expect(resolveSiteOrigin()).toBe("https://court-vizion.netlify.app");
  });

  it("reduces a configured value with a path to its bare origin", () => {
    clearSiteEnv();
    stubEnv({ key: "NEXT_PUBLIC_SITE_URL", value: "https://courtvision.example/players?tab=1" });

    expect(resolveSiteOrigin()).toBe("https://courtvision.example");
  });

  it("ignores a value that is not a parseable absolute URL", () => {
    clearSiteEnv();
    stubEnv({ key: "NEXT_PUBLIC_SITE_URL", value: "courtvision.example" });
    stubEnv({ key: "URL", value: "https://court-vizion.netlify.app" });

    expect(resolveSiteOrigin()).toBe("https://court-vizion.netlify.app");
  });

  it("ignores a non-http scheme", () => {
    clearSiteEnv();
    stubEnv({ key: "NEXT_PUBLIC_SITE_URL", value: "javascript:alert(1)" });

    expect(resolveSiteOrigin()).toBe(FALLBACK);
  });
});

describe("resolveSiteOrigin", () => {
  it("uses the configured origin and ignores the request header", () => {
    clearSiteEnv();
    stubEnv({ key: "NEXT_PUBLIC_SITE_URL", value: "https://courtvision.example" });

    expect(resolveSiteOrigin({ requestOrigin: "https://attacker.example" })).toBe(
      "https://courtvision.example",
    );
  });

  it("falls back to the request origin when nothing is configured", () => {
    clearSiteEnv();
    expect(resolveSiteOrigin({ requestOrigin: "http://localhost:46644" })).toBe(
      "http://localhost:46644",
    );
  });

  it("falls back to localhost when there is no origin at all", () => {
    clearSiteEnv();
    expect(resolveSiteOrigin({ requestOrigin: null })).toBe(FALLBACK);
    expect(resolveSiteOrigin()).toBe(FALLBACK);
  });

  it("rejects a request origin that is not a parseable http URL", () => {
    clearSiteEnv();
    expect(resolveSiteOrigin({ requestOrigin: "null" })).toBe(FALLBACK);
  });
});
