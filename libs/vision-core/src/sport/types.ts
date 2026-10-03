import { type FantasyMethodKey, type MethodCopy } from "#core/valuation/types";

// The vocabulary a sport plugs into the shared engine. Each key is a
// string-literal union the sport lib supplies (built from `as const` tuples),
// so a descriptor that names a stat, category, group, or slot it never
// declared fails to compile.
export type SportKeys = {
  valued: string; // per-game stats a valuation line carries, with second moments
  counting: string; // counting category keys
  ratio: string; // ratio category keys
  scoring: string; // points-league scoring keys (a subset of `valued`)
  group: string; // position groups that positional value and slots read
  slot: string; // roster slot types
};

export type Category<K extends SportKeys> = K["counting"] | K["ratio"];

// Whether more of a category is good (points) or bad (turnovers, ERA).
export type Direction = "higher" | "lower";

export type CategoryCopy = {
  label: string;
  fullName: string;
  description: string;
  formula: string;
};

export type CountingCategoryDef<K extends SportKeys> = CategoryCopy & {
  kind: "counting";
  key: K["counting"];
  stat: K["valued"]; // the stat the category totals (3PM totals `fg3m`)
  direction: Direction;
};

// A ratio category scores volume-weighted impact rather than the raw rate:
// rate = scale · numerator ÷ denominator, impact = denominator · (rate − league
// rate), negated when lower is better. Scale turns a raw ratio into the rate
// people read (ERA is 27 · earned runs ÷ outs); FG% has scale 1.
export type RatioCategoryDef<K extends SportKeys> = CategoryCopy & {
  kind: "ratio";
  key: K["ratio"];
  numerator: K["valued"];
  denominator: K["valued"];
  scale: number;
  direction: Direction;
};

export type CategoryDef<K extends SportKeys> = CountingCategoryDef<K> | RatioCategoryDef<K>;

// One valuation pool: who competes against whom. Basketball has one; hockey
// splits skaters from goalies and baseball hitters from pitchers, because they
// never compete in the same categories.
export type PoolDef<K extends SportKeys> = {
  key: string;
  label: string;
  groups: readonly K["group"][] | "all";
  categories: readonly Category<K>[];
  minGamesShare: number; // share of the window a pool member must have played
  minPlayingTimePerGame: number; // rotation-player floor (0 = none)
  poolFloor: number; // smallest pool size, however small the league
};

export type SlotKind = "starter" | "bench" | "injured";

export type SlotDef<K extends SportKeys> = {
  type: K["slot"];
  label: string;
  fullName: string;
  kind: SlotKind;
  max: number; // stepper ceiling on the create page
  defaultCount: number;
  accepts: readonly K["group"][] | "any";
};

export type SportDescriptor<K extends SportKeys> = {
  id: string;
  name: string;
  league: string;
  scheduleGames: number;
  season: { label: (args: { startYear: number }) => string };
  // What a "game played" is measured in (minutes, time on ice, outs, snaps).
  // A game counts as an appearance when it is above zero. `perUnit` is the
  // pace rate charts normalize to (per 36 minutes), or null when none applies.
  playingTime: { label: string; perUnit: number | null };
  valuedStats: readonly K["valued"][];
  // Column headings for the valued stats (box scores, points tables).
  statLabels: Readonly<Record<K["valued"], string>>;
  counting: { readonly [C in K["counting"]]: CountingCategoryDef<K> & { key: C } };
  ratio: { readonly [R in K["ratio"]]: RatioCategoryDef<K> & { key: R } };
  // Table order, and the order every multi-category sum adds in.
  categoryOrder: readonly Category<K>[];
  pools: readonly [PoolDef<K>, ...PoolDef<K>[]];
  // The league a fresh page assumes until the user says otherwise.
  defaultLeague: { teams: number; rosterSlots: number };
  points: {
    keys: readonly (K["scoring"] & K["valued"])[];
    defaults: Readonly<Record<K["scoring"], number>>;
  };
  positions: {
    groups: readonly K["group"][];
    parse: (position: string | null) => K["group"][];
    replacementSlots: Readonly<Record<K["group"], number>>;
  };
  slots: readonly SlotDef<K>[];
  // The method columns that mean something for this sport, in display order.
  // A points-only sport (no categories) keeps points and the replacement
  // methods; Z-Score, G-Score, SGP and Sim Value need categories.
  methods: readonly FantasyMethodKey[];
  // What VORP and positional value subtract a replacement level from: the
  // Z-Score total (category sports) or the points total (points-only sports).
  replacementBase: "z" | "points";
  // Sport-specific wording for the method registry; anything absent keeps
  // the sport-neutral default.
  methodCopy: Partial<Record<FantasyMethodKey, Partial<MethodCopy>>>;
};
