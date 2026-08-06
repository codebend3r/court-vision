import type { Profile } from "@generated/prisma/client";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Both reads are wrapped in React `cache` so they dedupe per request. The
// layout and half a dozen components each ask for the session independently;
// without this every one of them costs its own `auth.getUser()` round trip to
// Supabase (and its own `Profile` query) on a single render.
const loadUser = async (): Promise<User | null> => {
  // Auth is optional locally; without Supabase env there is no session, so skip
  // the client (which would otherwise throw) and treat the request as signed out.
  if (!isSupabaseConfigured()) {
    return null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
};

export const getUser = cache(loadUser);

const loadProfile = async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) {
    return null;
  }
  return prisma.profile.findUnique({ where: { id: user.id } });
};

export const getProfile = cache(loadProfile);
