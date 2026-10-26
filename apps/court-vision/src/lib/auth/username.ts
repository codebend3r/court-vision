import { z } from "zod";

const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "login",
  "logout",
  "signup",
  "signin",
  "signout",
  "auth",
  "api",
  "settings",
  "account",
  "profile",
  "courtvision",
  "support",
]);

type NormalizeUsernameProps = { username: string };

export function normalizeUsername({ username }: NormalizeUsernameProps): string {
  return username.trim().toLowerCase();
}

export const usernameSchema = z
  .string()
  .transform((username) => normalizeUsername({ username }))
  .pipe(
    z
      .string()
      .min(3, "Username must be at least 3 characters.")
      .max(20, "Username must be at most 20 characters.")
      .regex(/^[a-z0-9_]+$/, "Use only lowercase letters, numbers, and underscores.")
      .refine((value) => !RESERVED.has(value), "That username is reserved."),
  );

export function isValidUsername(value: string): boolean {
  return usernameSchema.safeParse(value).success;
}
