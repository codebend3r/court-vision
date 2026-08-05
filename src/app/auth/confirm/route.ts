import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/safeNextPath";
import { createClient } from "@/lib/supabase/server";

function isOtpType(value: string | null): value is EmailOtpType {
  return (
    value === "signup" ||
    value === "email" ||
    value === "recovery" ||
    value === "invite" ||
    value === "email_change"
  );
}

// Supabase speaks two dialects here, and which one arrives depends on the
// project's email template rather than on anything this app controls:
//
//   - The stock template links to Supabase's /auth/v1/verify, which verifies the
//     token itself and then bounces the browser here with `?code=` — a PKCE
//     authorization code, because @supabase/ssr pins flowType: "pkce" on every
//     client it builds. That code still has to be exchanged for a session.
//   - A template customized to `{{ .TokenHash }}` links straight here with
//     `token_hash` + `type`, which we verify ourselves.
//
// Accept both, so confirmation keeps working whichever template the project is
// configured with.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const home = NextResponse.redirect(new URL(next, origin));

  if (!!code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return home;
    }
  } else if (!!tokenHash && isOtpType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return home;
    }
  }

  // Covers a missing/!unusable token and Supabase's own `?error=` bounce
  // (expired or already-used links land here).
  return NextResponse.redirect(new URL("/login?error=confirm", origin));
}
