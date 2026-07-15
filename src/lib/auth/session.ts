import type { Profile } from "@generated/prisma/client";
import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function getUser(): Promise<User | null> {
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
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }
  return prisma.profile.findUnique({ where: { id: user.id } });
}
