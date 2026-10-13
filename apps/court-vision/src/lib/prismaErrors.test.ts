import { describe, expect, it } from "bun:test";

import {
  PRISMA_RECORD_NOT_FOUND,
  PRISMA_UNIQUE_VIOLATION,
  hasPrismaCode,
} from "@/lib/prismaErrors";

describe("hasPrismaCode", () => {
  it("matches an error carrying the code", () => {
    expect(hasPrismaCode({ error: { code: "P2002" }, code: PRISMA_UNIQUE_VIOLATION })).toBe(true);
    expect(hasPrismaCode({ error: { code: "P2025" }, code: PRISMA_RECORD_NOT_FOUND })).toBe(true);
  });

  it("rejects a different code, a codeless error, and non-objects", () => {
    expect(hasPrismaCode({ error: { code: "P2025" }, code: PRISMA_UNIQUE_VIOLATION })).toBe(false);
    expect(hasPrismaCode({ error: new Error("boom"), code: PRISMA_UNIQUE_VIOLATION })).toBe(false);
    expect(hasPrismaCode({ error: null, code: PRISMA_UNIQUE_VIOLATION })).toBe(false);
    expect(hasPrismaCode({ error: "P2002", code: PRISMA_UNIQUE_VIOLATION })).toBe(false);
  });
});
