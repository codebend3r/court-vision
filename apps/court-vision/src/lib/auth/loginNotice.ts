// /auth/confirm redirects to /login?error=<code> when a confirmation link fails,
// but nothing ever rendered that param — the user landed on a bare sign-in form
// with no hint that their link had expired. These map the codes the route emits
// to copy the login page can show.

const NOTICE_MESSAGES = {
  confirm:
    "That confirmation link didn't work — it may have expired or already been used. Sign in below and we'll send you a fresh one.",
} as const;

export type LoginNoticeCode = keyof typeof NOTICE_MESSAGES;

// Object.hasOwn, not `in`: `in` walks the prototype chain, so "toString" and
// "constructor" would both pass as valid codes.
export function isLoginNoticeCode(value: string | null | undefined): value is LoginNoticeCode {
  return typeof value === "string" && Object.hasOwn(NOTICE_MESSAGES, value);
}

export function loginNoticeMessage(code: LoginNoticeCode): string {
  return NOTICE_MESSAGES[code];
}

// Supabase rejects a sign-in from an unconfirmed account. Recent versions carry
// a stable `code`, older ones only the prose message, so check both rather than
// leaving the user staring at "Email not confirmed" with no way forward.
export function isUnconfirmedEmailError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) {
    return false;
  }
  return (
    error.code === "email_not_confirmed" || !!error.message?.toLowerCase().includes("not confirmed")
  );
}
