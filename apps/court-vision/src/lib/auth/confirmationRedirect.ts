import { headers } from "next/headers";

import { resolveSiteOrigin } from "@/lib/siteUrl";

// Where a confirmation email should land the user. Signup and resend must agree
// on this, and both must produce an origin that is on the Supabase project's
// redirect allow-list — Supabase silently discards an emailRedirectTo it doesn't
// recognise and falls back to the dashboard Site URL instead.
//
// Deliberately not in a "use server" module: every export of one of those becomes
// a callable server action endpoint, and this is an internal helper.
export async function confirmationRedirectTo(): Promise<string> {
  const requestOrigin = (await headers()).get("origin");
  return `${resolveSiteOrigin({ requestOrigin })}/auth/confirm`;
}
