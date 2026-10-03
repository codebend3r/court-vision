export type FontScale = "sm" | "default" | "lg" | "xl";

export const FONT_SCALES: readonly FontScale[] = ["sm", "default", "lg", "xl"];

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  sm: "Small",
  default: "Default",
  lg: "Large",
  xl: "X-Large",
};

export type PreferencesActionResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "unauthenticated" }
  | { status: "error" };
