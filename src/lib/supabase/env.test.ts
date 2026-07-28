import { afterEach, describe, expect, it } from "bun:test";

import { restoreEnv, stubEnv } from "@/lib/testing/env";

import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

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
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("returns null when either value is missing or blank", () => {
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_URL", value: "https://example.supabase.co" });
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: "" });

    expect(getSupabaseEnv()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });
});
