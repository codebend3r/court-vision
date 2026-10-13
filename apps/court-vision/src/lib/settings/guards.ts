import { FONT_SCALES, type FontScale } from "@/lib/settings/types";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";
import { type FantasyMethodKey } from "@vision/core/valuation/types";

export const isFontScale = (value: string): value is FontScale =>
  FONT_SCALES.some((scale) => scale === value);

// Only a method basketball registers can be a preference — a stored key the
// registry no longer lists simply stops validating and the app falls back to
// defaults.
export const isPreferredFormula = (value: string): value is FantasyMethodKey =>
  FANTASY_METHODS.some((method) => method.key === value);

// Validate and extract the font scale from a profile object. Falls back to
// "default" if the stored value is invalid or missing.
export const fontScaleOf = ({ profile }: { profile: { fontScale: string } | null }): FontScale => {
  const value = profile?.fontScale ?? "";
  return isFontScale(value) ? value : "default";
};
