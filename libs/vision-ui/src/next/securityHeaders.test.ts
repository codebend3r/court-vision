import { describe, expect, it } from "bun:test";

import { SECURITY_HEADERS } from "#ui/next/securityHeaders";

const valueOf = (key: string) => SECURITY_HEADERS.find((header) => header.key === key)?.value;

describe("SECURITY_HEADERS", () => {
  it("refuses framing two ways, old and new", () => {
    expect(valueOf("X-Frame-Options")).toBe("DENY");
    expect(valueOf("Content-Security-Policy")).toBe("frame-ancestors 'none'");
  });

  it("pins HTTPS and denies the device APIs no app uses", () => {
    expect(valueOf("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(valueOf("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("sends each header once", () => {
    const keys = SECURITY_HEADERS.map((header) => header.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
