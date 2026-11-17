import { z, type ZodError } from "zod";

// What every auth form action answers. Deliberately not in a "use server"
// module: every export of one of those becomes a callable endpoint.
export type AuthFormResult = { ok: true } | { ok: false; error: string };

export const emailSchema = z.string().email("Enter a valid email.");

// The first validation issue's message, which the form shows under its fields.
type FirstIssueProps = { error: ZodError; fallback: string };

export const firstIssue = ({ error, fallback }: FirstIssueProps): AuthFormResult => ({
  ok: false,
  error: error.issues[0]?.message ?? fallback,
});
