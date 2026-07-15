import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabaseEnv", () => {
  it("returns the pair when both the url and key are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_abc");

    expect(getSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      key: "sb_publishable_abc",
    });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("returns null when either value is missing or blank", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(getSupabaseEnv()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });
});
