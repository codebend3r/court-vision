import { FONT_SCALES, type FontScale } from "@/lib/settings/types";
import { ENABLED_METHODS, type FantasyMethodKey } from "@/lib/valuation/registry";

export const isFontScale = (value: string): value is FontScale =>
  FONT_SCALES.some((scale) => scale === value);

// Only methods the registry marks available can be a preference — an entry
// that later flips to available: false simply stops validating and the app
// falls back to defaults.
export const isPreferredFormula = (value: string): value is FantasyMethodKey =>
  ENABLED_METHODS.some((method) => method.key === value);

// Validate and extract the font scale from a profile object. Falls back to
// "default" if the stored value is invalid or missing.
export const fontScaleOf = ({ profile }: { profile: { fontScale: string } | null }): FontScale => {
  const value = profile?.fontScale ?? "";
  return isFontScale(value) ? value : "default";
};
