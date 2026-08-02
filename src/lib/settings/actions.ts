"use server";

import { getProfile } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isFontScale, isPreferredFormula } from "@/lib/settings/guards";
import { type PreferencesActionResult } from "@/lib/settings/types";

// null preferredFormula = "no preference", falls back to app defaults.
export const updatePreferences = async ({
  preferredFormula,
  fontScale,
}: {
  preferredFormula?: string | null;
  fontScale?: string;
}): Promise<PreferencesActionResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  if (
    preferredFormula !== undefined &&
    preferredFormula !== null &&
    !isPreferredFormula(preferredFormula)
  ) {
    return { status: "invalid" };
  }
  if (fontScale !== undefined && !isFontScale(fontScale)) return { status: "invalid" };
  try {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        ...(preferredFormula === undefined ? {} : { preferredFormula }),
        ...(fontScale === undefined ? {} : { fontScale }),
      },
    });
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
};
