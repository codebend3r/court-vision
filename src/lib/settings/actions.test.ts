import { beforeEach, describe, expect, it, vi } from "bun:test";

const update = vi.fn();
const getProfile = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { update },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));

import { updatePreferences } from "@/lib/settings/actions";

const profile = { id: "prof-1" };

beforeEach(() => {
  update.mockReset();
  getProfile.mockReset();

  getProfile.mockResolvedValue(profile);
  update.mockResolvedValue({});
});

describe("updatePreferences", () => {
  it("returns unauthenticated when no profile", async () => {
    getProfile.mockResolvedValue(null);
    const result = await updatePreferences({ fontScale: "lg" });
    expect(result).toEqual({ status: "unauthenticated" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns invalid for invalid fontScale", async () => {
    const result = await updatePreferences({ fontScale: "xxl" });
    expect(result).toEqual({ status: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns invalid for invalid preferredFormula", async () => {
    const result = await updatePreferences({ preferredFormula: "montecarlo" });
    expect(result).toEqual({ status: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates only fontScale when provided", async () => {
    const result = await updatePreferences({ fontScale: "lg" });
    expect(result).toEqual({ status: "ok" });
    expect(update).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { fontScale: "lg" },
    });
  });

  it("updates only preferredFormula when provided", async () => {
    const result = await updatePreferences({ preferredFormula: "zscore" });
    expect(result).toEqual({ status: "ok" });
    expect(update).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { preferredFormula: "zscore" },
    });
  });

  it("updates both when both provided", async () => {
    const result = await updatePreferences({ fontScale: "lg", preferredFormula: "simvalue" });
    expect(result).toEqual({ status: "ok" });
    expect(update).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { fontScale: "lg", preferredFormula: "simvalue" },
    });
  });

  it("omits undefined fields from update data", async () => {
    const result = await updatePreferences({ fontScale: "lg" });
    expect(result).toEqual({ status: "ok" });
    const callArgs = update.mock.calls[0]?.[0];
    expect(callArgs?.data).not.toHaveProperty("preferredFormula");
  });

  it("allows null preferredFormula (clearing preference)", async () => {
    const result = await updatePreferences({ preferredFormula: null });
    expect(result).toEqual({ status: "ok" });
    expect(update).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { preferredFormula: null },
    });
  });

  it("returns error on database exception", async () => {
    update.mockRejectedValueOnce(new Error("db error"));
    const result = await updatePreferences({ fontScale: "lg" });
    expect(result).toEqual({ status: "error" });
  });
});
