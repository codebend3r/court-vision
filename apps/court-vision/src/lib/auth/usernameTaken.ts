import { normalizeUsername } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";

// Whether a profile already holds this username, compared case-insensitively.
//
// Deliberately not in a "use server" module: every export of one of those becomes
// a callable server action endpoint, and the signup action and the
// /api/username-available route call this directly. It also stays out of
// `username.ts`, which the client-side signup form imports, so the Prisma client
// never reaches the browser bundle.
type IsUsernameTakenProps = { username: string };

export async function isUsernameTaken({ username }: IsUsernameTakenProps): Promise<boolean> {
  const existing = await prisma.profile.findFirst({
    where: { username: { equals: normalizeUsername({ username }), mode: "insensitive" } },
    select: { id: true },
  });
  return !!existing;
}
