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

// The method a stored preference names, or null when it names none this build
// registers. Every surface that honours the preference reads it here.
type PreferredMethodOfProps = { preferredFormula: string | null };

export const preferredMethodOf = ({
  preferredFormula,
}: PreferredMethodOfProps): FantasyMethodKey | null =>
  preferredFormula !== null && isPreferredFormula(preferredFormula) ? preferredFormula : null;

// Validate and extract the font scale from a profile object. Falls back to
// "default" if the stored value is invalid or missing.
type FontScaleOfProps = { profile: { fontScale: string } | null };

export const fontScaleOf = ({ profile }: FontScaleOfProps): FontScale => {
  const value = profile?.fontScale ?? "";
  return isFontScale(value) ? value : "default";
};
