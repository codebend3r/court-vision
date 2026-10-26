"use server";

import { z } from "zod";

import { confirmationRedirectTo } from "@/lib/auth/confirmationRedirect";
import { RESET_PATH } from "@/lib/auth/loginNotice";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().email("Enter a valid email.");

type ResetResult = { ok: true } | { ok: false; error: string };

// Mails a recovery link that lands on /auth/confirm, which exchanges it for a
// session and forwards to the new-password form. Supabase answers success for an
// address with no account, so this never reveals which emails are registered.
type RequestPasswordResetProps = { email: string };

export async function requestPasswordReset({
  email,
}: RequestPasswordResetProps): Promise<ResetResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
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
