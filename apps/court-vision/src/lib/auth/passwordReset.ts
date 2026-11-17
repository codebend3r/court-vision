"use server";

import { confirmationRedirectTo } from "@/lib/auth/confirmationRedirect";
import { type AuthFormResult, emailSchema, firstIssue } from "@/lib/auth/formResult";
import { RESET_PATH } from "@/lib/auth/loginNotice";
import { createClient } from "@/lib/supabase/server";

// Mails a recovery link that lands on /auth/confirm, which exchanges it for a
// session and forwards to the new-password form. Supabase answers success for an
// address with no account, so this never reveals which emails are registered.
type RequestPasswordResetProps = { email: string };

export async function requestPasswordReset({
  email,
}: RequestPasswordResetProps): Promise<AuthFormResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return firstIssue({ error: parsed.error, fallback: "Enter a valid email." });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: await confirmationRedirectTo({ next: RESET_PATH }),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
