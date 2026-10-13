"use server";

import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
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
}): Promise<PreferencesActionResult> =>
  withProfile<PreferencesActionResult>({
    getProfile,
    run: async ({ profile }) => {
      if (
        preferredFormula !== undefined &&
        preferredFormula !== null &&
        !isPreferredFormula(preferredFormula)
      ) {
        return { status: "invalid" };
      }
      if (fontScale !== undefined && !isFontScale(fontScale)) return { status: "invalid" };
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          ...(preferredFormula === undefined ? {} : { preferredFormula }),
          ...(fontScale === undefined ? {} : { fontScale }),
        },
      });
      return { status: "ok" };
    },
  });
