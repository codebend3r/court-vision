import { beforeEach, describe, expect, it, vi } from "bun:test";

const query = vi.fn();
const execute = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: query, $executeRaw: execute } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { allowUsernameAttempt, usernameRateKey } from "@/lib/auth/usernameRateLimit";

beforeEach(() => {
  execute.mockReset();
  query.mockReset();
  execute.mockResolvedValue(0);
  query.mockResolvedValue([{ key: "allowed" }]);
});

describe("usernameRateKey", () => {
  it("uses only valid Netlify client IPs and never stores raw addresses", () => {
    const shared = usernameRateKey({ netlify: false, clientIp: null });
    expect(usernameRateKey({ netlify: false, clientIp: "1.2.3.4" })).toBe(shared);
    expect(usernameRateKey({ netlify: true, clientIp: "fake" })).toBe(shared);
    expect(usernameRateKey({ netlify: true, clientIp: null })).toBe(shared);
    const address = usernameRateKey({ netlify: true, clientIp: "1.2.3.4" });
    expect(address).not.toBe(shared);
    expect(address).not.toContain("1.2.3.4");
    expect(usernameRateKey({ netlify: true, clientIp: "::1" })).not.toBe(shared);
  });
});

describe("allowUsernameAttempt", () => {
  it("uses a bound, atomic counter and removes expired buckets", async () => {
    expect(await allowUsernameAttempt()).toBe(true);
    const [sql, key] = query.mock.calls[0] ?? [];
    expect(sql.join("?")).toContain("ON CONFLICT (key) DO UPDATE");
    expect(sql.join("?")).toContain('"RequestRateLimit".attempts < 30');
    expect(key).toMatch(/^username:[a-f0-9]{64}$/);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("denies exhausted counters and fails closed on storage errors", async () => {
    query.mockResolvedValueOnce([]);
    expect(await allowUsernameAttempt()).toBe(false);
    execute.mockRejectedValueOnce(new Error("Database unavailable"));
    expect(await allowUsernameAttempt()).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
