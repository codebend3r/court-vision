export type StatKey =
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "min"
  | "tov"
  | "fgPct"
  | "fg3Pct"
  | "ftPct";
export type StatPanel = "counting" | "shooting";

export interface StatMeta {
  key: StatKey;
  label: string;
  panel: StatPanel;
  color: string;
}

export const STAT_META: StatMeta[] = [
  { key: "pts", label: "PTS", panel: "counting", color: "#3987e5" },
  { key: "reb", label: "REB", panel: "counting", color: "#199e70" },
  { key: "ast", label: "AST", panel: "counting", color: "#c98500" },
  { key: "stl", label: "STL", panel: "counting", color: "#008300" },
  { key: "blk", label: "BLK", panel: "counting", color: "#9085e9" },
  { key: "min", label: "MIN", panel: "counting", color: "#e66767" },
  { key: "tov", label: "TOV", panel: "counting", color: "#d55181" },
  { key: "fgPct", label: "FG%", panel: "shooting", color: "#3987e5" },
  { key: "fg3Pct", label: "3P%", panel: "shooting", color: "#199e70" },
  { key: "ftPct", label: "FT%", panel: "shooting", color: "#c98500" },
];

export const DEFAULT_ACTIVE_KEYS: StatKey[] = ["pts", "reb", "ast"];
