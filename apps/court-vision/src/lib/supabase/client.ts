import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient(url, key);
}
