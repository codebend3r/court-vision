import { afterEach, describe, expect, it } from "bun:test";

import { restoreEnv, stubEnv } from "@vision/testing/env";

import { getSupabaseEnv, requireSupabaseEnv } from "@/lib/supabase/env";

afterEach(() => {
  restoreEnv();
});

describe("getSupabaseEnv", () => {
  it("returns the pair when both the url and key are set", () => {
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_URL", value: "https://example.supabase.co" });
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: "sb_publishable_abc" });

    expect(getSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      key: "sb_publishable_abc",
    });
  });

  it("returns null when either value is missing or blank", () => {
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_URL", value: "https://example.supabase.co" });
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: "" });

    expect(getSupabaseEnv()).toBeNull();
  });
});

describe("requireSupabaseEnv", () => {
  it("returns the pair when Supabase is configured", () => {
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_URL", value: "https://example.supabase.co" });
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: "sb_publishable_abc" });

    expect(requireSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      key: "sb_publishable_abc",
    });
  });

  it("throws, naming the variables, when either value is missing", () => {
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_URL", value: "" });
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: "sb_publishable_abc" });

    expect(() => requireSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
