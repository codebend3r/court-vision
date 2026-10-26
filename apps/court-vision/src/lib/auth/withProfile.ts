import type { Profile } from "@generated/prisma/client";

// The two answers every account action shares: nobody is signed in, or
// something threw. Server actions cross the RSC boundary, where a thrown error
// reaches the client as an opaque digest, so both travel as results instead.
export type SessionFailure = { status: "unauthenticated" } | { status: "error" };

// The guard a server action runs its body through: resolve the profile,
// answer "unauthenticated" without one, and turn anything that throws (the
// session lookup included) into "error". The action hands in the session's
// own `getProfile`, so the lookup stays visible at each call site and a test
// that mocks `@/lib/auth/session` needs nothing more.
type RunProps = { profile: Profile };

type WithProfileProps<R> = {
  getProfile: () => Promise<Profile | null>;
  run: (args: RunProps) => Promise<R>;
};

export const withProfile = async <R>({
  getProfile,
  run,
}: WithProfileProps<R>): Promise<R | SessionFailure> => {
  try {
    const profile = await getProfile();
    if (profile === null) return { status: "unauthenticated" };
    return await run({ profile });
  } catch (error) {
    // The client only sees "error", so the cause goes to the server log.
    console.error("withProfile: server action failed", error);
    return { status: "error" };
  }
};
