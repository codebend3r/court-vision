"use server";

import { z } from "zod";

import { confirmationRedirectTo } from "@/lib/auth/confirmationRedirect";
import { type AuthFormResult, emailSchema, firstIssue } from "@/lib/auth/formResult";
import { usernameSchema } from "@/lib/auth/username";
import { isUsernameTaken } from "@/lib/auth/usernameTaken";
import { allowUsernameAttempt, USERNAME_RATE_LIMIT_MESSAGE } from "@/lib/auth/usernameRateLimit";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type SignUpProps = {
  email: string;
  username: string;
  password: string;
};

export async function signUp(input: SignUpProps): Promise<AuthFormResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return firstIssue({ error: parsed.error, fallback: "Invalid input." });
  }

  const { email, username, password } = parsed.data;

  if (!(await allowUsernameAttempt())) return { ok: false, error: USERNAME_RATE_LIMIT_MESSAGE };
  if (await isUsernameTaken({ username })) {
    return { ok: false, error: "That username is taken." };
  }

  // Without an explicit emailRedirectTo, Supabase falls back to the project's
  // dashboard Site URL for the confirmation link — which is how a production
  // signup ended up mailing a localhost link.
  const emailRedirectTo = await confirmationRedirectTo();

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username }, emailRedirectTo },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return { ok: false, error: "That username is taken." };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// Accounts created before the confirmation link was fixed were mailed a
// localhost URL they could never click, so they are stuck unconfirmed with no
// way out of the sign-in form. This re-sends the signup confirmation, now
// pointing at a reachable origin.
type ResendConfirmationProps = { email: string };

export async function resendConfirmation({
  email,
}: ResendConfirmationProps): Promise<AuthFormResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return firstIssue({ error: parsed.error, fallback: "Enter a valid email." });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: await confirmationRedirectTo() },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
