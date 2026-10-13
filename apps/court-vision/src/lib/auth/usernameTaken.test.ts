import { beforeEach, describe, expect, it, vi } from "bun:test";

const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { profile: { findFirst: (...args: unknown[]) => findFirst(...args) } },
}));

import { isUsernameTaken } from "@/lib/auth/usernameTaken";

describe("isUsernameTaken", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("looks the normalized username up case-insensitively", async () => {
    findFirst.mockResolvedValue(null);

    await isUsernameTaken({ username: "  SteveN_1 " });

    expect(findFirst).toHaveBeenCalledWith({
      where: { username: { equals: "steven_1", mode: "insensitive" } },
      select: { id: true },
    });
  });

  it("reports a username a profile already holds", async () => {
    findFirst.mockResolvedValue({ id: "uuid-1" });
    expect(await isUsernameTaken({ username: "steve" })).toBe(true);
  });

  it("reports a free username", async () => {
    findFirst.mockResolvedValue(null);
    expect(await isUsernameTaken({ username: "steve" })).toBe(false);
  });
});
