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
// A parsed attempt, so that reading the query string and acting on it stay
// separate concerns. Nothing here decides whether the user is allowed in — that
// is Supabase's answer alone, below.
type ConfirmAttempt =
  | { readonly kind: "code"; readonly code: string }
  | { readonly kind: "otp"; readonly type: EmailOtpType; readonly tokenHash: string }
  | { readonly kind: "none" };

function readAttempt(searchParams: URLSearchParams): ConfirmAttempt {
  const code = searchParams.get("code");
  if (!!code) {
    return { kind: "code", code };
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (!!tokenHash && isOtpType(type)) {
    return { kind: "otp", type, tokenHash };
  }

  // No usable credential: a bare request, or Supabase's own `?error=` bounce
  // when a link is expired or already used.
  return { kind: "none" };
}

// The single authority on whether this request confirmed an account. Dispatches
// on the tag `readAttempt` produced rather than on raw request parameters, so no
// request-controlled value gates the auth calls; a forged or absent credential
// can only ever produce `false`.
async function isConfirmed(attempt: ConfirmAttempt): Promise<boolean> {
  if (attempt.kind === "none") {
    return false;
  }

  const supabase = await createClient();
  const { error } =
    attempt.kind === "code"
      ? await supabase.auth.exchangeCodeForSession(attempt.code)
      : await supabase.auth.verifyOtp({ type: attempt.type, token_hash: attempt.tokenHash });

  return !error;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const confirmed = await isConfirmed(readAttempt(searchParams));

  return NextResponse.redirect(new URL(confirmed ? next : "/login?error=confirm", origin));
}
