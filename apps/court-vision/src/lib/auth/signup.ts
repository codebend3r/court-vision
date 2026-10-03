"use server";

import { z } from "zod";

import { confirmationRedirectTo } from "@/lib/auth/confirmationRedirect";
import { normalizeUsername, usernameSchema } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  email: z.string().email("Enter a valid email."),
  username: usernameSchema,
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function isUsernameTaken(username: string): Promise<boolean> {
  const existing = await prisma.profile.findFirst({
    where: { username: { equals: normalizeUsername(username), mode: "insensitive" } },
    select: { id: true },
  });
  return !!existing;
}

type SignUpResult = { ok: true } | { ok: false; error: string };

export async function signUp(input: {
  email: string;
  username: string;
  password: string;
}): Promise<SignUpResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, username, password } = parsed.data;

  if (await isUsernameTaken(username)) {
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

const emailSchema = z.string().email("Enter a valid email.");

// Accounts created before the confirmation link was fixed were mailed a
// localhost URL they could never click, so they are stuck unconfirmed with no
// way out of the sign-in form. This re-sends the signup confirmation, now
// pointing at a reachable origin.
export async function resendConfirmation({ email }: { email: string }): Promise<SignUpResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
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
