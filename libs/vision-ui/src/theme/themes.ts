// The six-theme registry. A theme may only redefine color tokens (see
// globals.scss); this module is the single list the swatch strip, the settings
// cards, and ThemeInitScript all draw from.
export const THEMES = [
  "dark",
  "light",
  "high-contrast",
  "colorblind-safe",
  "amber-crt",
  "team-accent",
] as const;

export type Theme = (typeof THEMES)[number];

export const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && THEMES.some((theme) => theme === value);

export type ThemeMeta = {
  id: Theme;
  label: string;
  // One line on what the theme is for, shown on the settings card.
  note: string;
  // Whether the theme's background is dark or light, for anything that must
  // contrast with it (a chart line, say). Its colors live in globals.scss
  // under `[data-theme]`; a swatch previews them by carrying the attribute.
  tone: "dark" | "light";
};

export const THEME_META: readonly ThemeMeta[] = [
  {
    id: "dark",
    label: "Dark",
    note: "The original navy palette, tuned for evening research.",
    tone: "dark",
  },
  {
    id: "light",
    label: "Light",
    note: "Bright rooms and daytime stat reading.",
    tone: "light",
  },
  {
    id: "high-contrast",
    label: "High contrast",
    note: "AAA text on pure black for maximum legibility.",
    tone: "dark",
  },
  {
    id: "colorblind-safe",
    label: "Colorblind-safe",
    note: "Blue and amber encoding — no red-green pairing.",
    tone: "dark",
  },
  {
    id: "amber-crt",
    label: "Amber CRT",
    note: "Warm phosphor glow for low-light drafting.",
    tone: "dark",
  },
  {
    id: "team-accent",
    label: "Team accent",
    note: "The accent follows your club's primary color.",
    tone: "dark",
  },
];
