"use server";

import { z } from "zod";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
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
