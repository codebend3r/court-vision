export type SupabaseEnv = {
  url: string;
  key: string;
};

// Supabase auth is optional in local/dev: when the public URL and key aren't
// both set, callers skip auth (the middleware no-ops, `getUser` returns null)
// instead of letting `createServerClient` throw on every request. Returns the
// pair only when fully configured so a half-filled `.env` counts as "off".
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return !!url && !!key ? { url, key } : null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}
