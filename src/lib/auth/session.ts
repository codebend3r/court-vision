import type { Profile } from "@generated/prisma/client";
import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getUser(): Promise<User | null> {
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
