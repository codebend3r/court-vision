// The six-theme registry. A theme may only redefine color tokens (see
// globals.scss); this module is the single list the swatch strip, the settings
// cards, and the init script all draw from.
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
  typeof value === "string" && (THEMES as readonly string[]).includes(value);

export type ThemeMeta = {
  id: Theme;
  label: string;
  // One line on what the theme is for, shown on the settings card.
  note: string;
  // Literal palette samples. Swatches preview every theme at once, so these
  // cannot read the live custom properties of the active theme.
  bg: string;
  surface: string;
  accent: string;
  accentStrong: string;
  text: string;
};

export const THEME_META: readonly ThemeMeta[] = [
  {
    id: "dark",
    label: "Dark",
    note: "The original navy court, tuned for evening research.",
    bg: "#131629",
    surface: "#1c2138",
    accent: "#3fc3e8",
    accentStrong: "#ff2e7e",
    text: "#e8eaf6",
  },
  {
    id: "light",
    label: "Light",
    note: "Bright rooms and daytime box-score reading.",
    bg: "#f7f8fc",
    surface: "#ffffff",
    accent: "#0b749a",
    accentStrong: "#d6206a",
    text: "#171b2e",
  },
  {
    id: "high-contrast",
    label: "High contrast",
    note: "AAA text on pure black for maximum legibility.",
    bg: "#000000",
    surface: "#0b0e1a",
    accent: "#6fe3ff",
    accentStrong: "#ff74ae",
    text: "#ffffff",
  },
  {
    id: "colorblind-safe",
    label: "Colorblind-safe",
    note: "Blue and amber encoding — no red-green pairing.",
    bg: "#0f1220",
    surface: "#191d2e",
    accent: "#5aa9ff",
    accentStrong: "#ffb02e",
    text: "#eef1f8",
  },
  {
    id: "amber-crt",
    label: "Amber CRT",
    note: "Warm phosphor glow for low-light drafting.",
    bg: "#120d05",
    surface: "#1d1409",
    accent: "#ffa726",
    accentStrong: "#ff7043",
    text: "#ffd694",
  },
  {
    id: "team-accent",
    label: "Team accent",
    note: "The accent follows your club's primary color.",
    bg: "#14161c",
    surface: "#1e222b",
    accent: "#ff3b5c",
    accentStrong: "#ffd166",
    text: "#f1f2f6",
  },
];
