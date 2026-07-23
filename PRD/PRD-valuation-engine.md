# PRD: Player Valuation Engine

|             |                                       |
| ----------- | ------------------------------------- |
| **Product** | Court Vision                          |
| **Feature** | Multi-method fantasy valuation engine |
| **Author**  | CJ Rivas                              |
| **Status**  | Draft                                 |
| **Version** | 0.2                                   |
| **Date**    | 2026-07-23                            |

**v0.2 changes:** rewritten as greenfield (no valuation code exists yet; v0.1
incorrectly described Z-Score as implemented); fixed the multi-position
replacement rule and auction-dollar conservation; split modifiers out of the
method union and made the config a discriminated union of type aliases;
defined weight semantics and a raw+weighted breakdown; updated data
dependencies to match the database (game logs and positions already exist);
re-ordered phasing accordingly; moved Sim Value out of the /players tab scope;
added §9.4 (integration with the existing /players page) and a pointer to the
Fantasy Value tab design spec.

---

## 1. Summary

Build a valuation engine that reduces a player's stat line to a single
comparable number under several different methodologies: Z-Score, G-Score,
Standings Gain Points, Points-League Linear, plus two composable modifiers —
Value Over Replacement (with auction-dollar output) and Positional Scarcity.
Each method encodes a different assumption about what "value" means, and the
user selects the one matching their league format and strategy.

All methods share one config surface (active categories, per-category weights,
league settings) and one output shape, so the Fantasy Value tab on `/players`
can swap methods or display them side by side without special casing. The tab
UI itself is specified in
`docs/superpowers/specs/2026-07-23-fantasy-value-tab-design.md`.

## 2. Background

Court Vision has **no valuation code today**. The Fantasy Value tab on
`/players` renders a ComingSoonPanel. What does exist is the data to build on:

- `PlayerSeasonStats` — season aggregates per player per season (2020–2025).
- `PlayerGameLog` — ~232k per-game box scores across 2020–2025, already used
  by the Regular Stats tab's lastN ranges.
- `PlayerAdvancedGameLog` — ~189k per-game advanced metric rows.
- `Player.position` — Balldontlie position strings ("G", "F-C", …).

Z-Score is the planned default method. It is a reasonable one, but it bakes in
three assumptions that do not hold for every league:

1. **Baseline.** It measures a player against the population mean, when the
   user's real alternative is the best freely available player on waivers.
2. **Scaling.** It weights each category by the standard deviation of season
   averages across the player pool, ignoring week to week variance that
   decides head to head matchups.
3. **Context.** It is roster-independent, so it cannot express diminishing
   returns. A third elite shot blocker scores the same as the first.

Each additional method relaxes one or more of those assumptions. The two
levers that separate them are **baseline** (population mean versus replacement
level versus your own roster) and **variance treatment** (season-average
spread versus weekly swing).

## 3. Goals

- Support category leagues (H2H and roto) and points leagues from one engine.
- Let the user pick a valuation method, include or exclude categories, and
  weight categories, with results updating instantly (no server round trip
  for config changes).
- Express punt strategies through category weights, including full exclusion.
- Keep the config-independent math cacheable server-side and the
  config-dependent math cheap enough to run on every client interaction.
- Produce one consistent output shape across methods so the Fantasy Value
  table can render them uniformly.
- Work well with zero configuration: an anonymous visitor with no league gets
  sensible defaults (12 teams, 13 roster slots, 9-cat H2H, all weights 1).

## 4. Non-goals

- Draft board, auction room, or live draft assistance. Auction dollar
  conversion is in scope as an output of the replacement modifier; the draft
  UI is not.
- Projection modeling. The engine values a supplied stat line. Whether that
  line is last season actuals, a lastN window, or a blend is upstream.
- Injury, schedule, or news adjustments.
- Monte Carlo Sim Value in the /players table. It is roster-dependent, so it
  cannot share the tab's cacheable ranking model; it is deferred to a future
  "who should I add" tool (see §6.6).
- Trade analysis.

## 5. Shared concepts

### 5.1 Player pool

No method produces a meaningful number for a player in isolation. Every
category method scores a player relative to a **reference pool**, the set of
players realistically rostered in the user's league.

- Default pool size: `teams * rosterSlots`, with a floor of 150.
- A minimum games played and minutes threshold filters out small sample noise
  before pool selection.
- Pool membership is determined by ranking on the **active method**, which is
  circular by nature. The engine runs a single refinement pass: compute
  values on the broad thresholded population using a provisional Z-Score
  ranking, trim to the top N, then recompute the active method's statistics
  (μ, σ, league percentages, replacement levels) on that pool. One pass, not
  iteration to convergence — the pool boundary is insensitive beyond that.
- Players outside the pool (including injured or low-game players who clear a
  display floor of one appearance in the window) are still **scored against**
  the pool without being members of it, so they can be displayed and ranked.

### 5.2 Categories

Standard 9-cat: PTS, REB, AST, STL, BLK, 3PM, TOV, FG%, FT%. The engine must
remain extensible to 8-cat, 10-cat with DD, and custom sets.

Two structural distinctions matter throughout:

- **Counting versus ratio.** Counting categories (PTS, REB, AST, STL, BLK,
  3PM, TOV) aggregate additively. Ratio categories (FG%, FT%) do not, and
  require makes and attempts rather than a percentage.
- **Positive versus negative.** TOV is the only standard category where a
  lower raw value is better. The sign flip happens once, inside each method's
  per-category primitive, so every downstream number reads "higher is better".

### 5.3 Ratio category handling

Averaging raw percentages is wrong: 90% on 2 attempts is not more valuable
than 55% on 20. Every category method must convert a ratio into a
volume-weighted impact before scaling:

```
fgImpact = fga * (fgm / fga - leagueFgPct)
ftImpact = fta * (ftm / fta - leagueFtPct)
```

where `leagueFgPct` and `leagueFtPct` are attempt-weighted pool averages, not
the mean of per-player percentages. This primitive is shared by Z-Score,
G-Score, and SGP.

### 5.4 Basis and window

Category methods operate on per-game rates by default, which suits H2H. A
`basis: 'perGame' | 'total'` setting switches to season totals, which credits
durability and matters more for roto. On the /players page, `basis` **is** the
existing `mode` URL param (average ↔ perGame, total ↔ total) — the tab must
not grow a second toggle for the same concept.

The stat **window** is the existing `range` param (`all`, `last5` … `last60`).
Each window is a distinct input stat line and therefore a distinct set of
cached primitives. The existing NBA leader `minimums` toggle does not apply on
the Fantasy tab; the pool thresholds in §5.1 replace it.

## 6. Valuation methods

### 6.1 Z-Score (default, Phase 1)

**Assumption:** value is distance from the average pool player, scaled by how
spread out that category is.

**Formula:** for each category, `z = (x - mu) / sigma` across the pool, with
TOV negated and ratio categories using the impact form from §5.3. Total value
is the weighted sum of included category z-scores.

**Inputs:** pool stats only.

**Interpretation:** 0 is an average pool player. Elite players land roughly in
the +8 to +15 range at default weights, depending on pool size.

**Strengths:** simple, no external data, good default.
**Weaknesses:** average-player baseline, ignores weekly variance and games
played, roster-independent.

**Config:** `categories`, `weights`.

---

### 6.2 G-Score

**Assumption:** in H2H, what matters is the probability of winning a category
in a given week, which depends on the weekly volatility of the category
total, not just the spread of season averages.

**Formula sketch:** the numerator is the same mean advantage as Z-Score, but
the denominator combines two sources of variance:

```
g = (x - mu) / sqrt(sigmaBetween^2 + sigmaWithin^2)
```

where `sigmaBetween` is the standard deviation of season averages across the
pool (the Z-Score denominator) and `sigmaWithin` is the typical week to week
standard deviation of a player's own output in that category. Categories with
high game to game volatility relative to their between-player spread get
compressed, because a season-average edge there is less reliably converted
into a weekly category win. Games played enters through weekly volume: a
player who plays fewer games contributes less to weekly totals and carries
proportionally more variance.

**Implementation gate:** this is a sketch of the published G-Score approach
(Rosenof), not a verbatim reproduction. The sketch above omits at least the
games-per-week scaling of the within-player variance term, and ratio
categories are a ratio of weekly sums that does not decompose the same way as
counting categories. **Verifying the exact formulation against the source
paper is an explicit deliverable of the G-Score phase, not optional.**
Within-player variance is computed with Welford's algorithm over game logs —
never a naive one-pass sum of squares.

**Inputs:** pool stats, games played, and per-player game-level variance per
category — all derivable from `PlayerGameLog`, which already exists. No new
data acquisition is required.

**Strengths:** built for the H2H weekly structure, corrects Z-Score's
overvaluation of low-volume specialists, accounts for games played.
**Weaknesses:** harder to explain to users; needs the formulation verified.

**Config:** `categories`, `weights`, plus `gamesBasis` for assumed games per
week.

---

### 6.3 Standings Gain Points (SGP)

**Assumption:** value is how far a stat moves you up the standings, calibrated
to the league you actually play in.

**Formula:** for each category, divide the player's contribution by that
category's **standings-gain denominator**, the average amount of that stat
separating adjacent places in the final standings:

```
sgp = playerStat / denominator[cat]
```

For ratio categories the denominator applies to the change in team ratio
caused by adding the player to an average team:

```
delta = (teamMakes + playerMakes) / (teamAtt + playerAtt) - teamPct
sgpRatio = delta / denominator[cat]
```

The average-team context (team makes/attempts) is derived from the pool: pool
totals divided by `teams`.

**Inputs:** pool stats plus per-category denominators. Denominators come from
the user's league history (user-supplied) or from a **sourced** defaults table
by league size and format. Shipping that table is a real content deliverable:
it requires a citable published source or a derivation from historical league
data we can defend. SGP does not ship until one exists — no invented numbers.

**Strengths:** calibrated to what actually wins the league rather than to the
shape of the player pool. Generally considered more accurate than Z-Score for
roto.
**Weaknesses:** needs denominator data, designed for roto rather than H2H,
denominators drift as league scoring environments change.

**Config:** `categories`, `weights`, `denominators`, `leagueSize`.

---

### 6.4 Points-League Linear

**Assumption:** in a points league every stat is already denominated in the
same unit, so no standardization is needed or wanted.

**Formula:** the dot product of the stat line with the league's scoring
settings:

```
value = sum over stats of stat * pointsPerStat
```

for example `pts * 1 + reb * 1.2 + ast * 1.5 + stl * 3 + blk * 3 - tov * 1`.

**Inputs:** the stat line and the league scoring table. No pool statistics are
required for the raw value; a pool is still needed when the replacement
modifier is applied, and that pool's refinement pass (§5.1) ranks by points
value, not Z-Score, so the pool boundary matches the league's actual economy.

**Strengths:** exactly correct for points leagues, trivially cheap, fully
transparent.
**Weaknesses:** meaningless for category leagues. The engine surfaces a
warning if the user selects it while their league format is set to
categories, and the reverse.

**Config:** `scoring` (a map of stat to point value), `basis`.

---

### 6.5 Modifier: Value Over Replacement (VORP)

**Assumption:** your alternative to rostering a player is not an average
player, it is the best player available on waivers. Value is the surplus over
that. This is a **modifier**, not a method: it is a baseline shift applied on
top of any method's output.

**Formula:**

```
vorp = baseValue(player) - baseValue(replacementPlayer)
```

Replacement level is the player ranked at `teams * rosterSlots` in the base
ranking, or optionally the top projected free agent. Because changing the
baseline changes the ranking, and the ranking determines the replacement
player, the engine runs one refinement pass rather than iterating.

**Positional variant:** compute replacement level per position slot rather
than globally, so the baseline reflects the pool of players eligible for that
slot (see §6.7).

**Auction dollars:** derived from the conservation constraint that the
dollars handed out must equal the league's total budget,
`B = teams * budget`, across the `N = teams * rosterSlots` rosterable
players. Every top-N player gets the $1 minimum bid; the surplus pool
`B - N` is distributed proportionally among top-N players with positive VORP:

```
dollars(p) = 1 + (vorp(p) / sumPositiveVorpTopN) * (B - N)   if p in top N and vorp(p) > 0
dollars(p) = 1                                               if p in top N and vorp(p) <= 0
dollars(p) = 0                                               otherwise
```

By construction the payouts sum to exactly `B` whatever the split between
positive- and non-positive-VORP players inside the top N.

**Inputs:** a base method output plus `teams` and `rosterSlots`. Optionally
the free agent pool.

**Strengths:** matches the real decision the manager faces, produces intuitive
auction values.
**Weaknesses:** sensitive to the replacement definition; inherits the base
method's flaws.

**Config:** `replacementRule`, `budget` (for dollar output); `teams` and
`rosterSlots` come from league settings.

---

### 6.6 Monte Carlo Matchup Simulation (Sim Value) — deferred

**Assumption:** value is roster-dependent. A player is worth exactly the
additional category wins they bring to _your_ team.

Sim Value simulates weekly matchups from per-player per-category
distributions (mean and variance from game logs, which already exist) and
values a candidate as the marginal change in expected categories won.

**Why deferred:** a roster-dependent number is incoherent in a public,
sortable, cacheable ranking table — two users would see different "rankings"
and neither is a property of the player. Sim Value's natural home is a
per-roster "who should I add" tool, which composes on top of this engine's
primitives (per-category means and variances) but is a separate feature with
its own PRD when we get there. Nothing in this engine's design blocks it: the
G-Score phase produces exactly the per-player variance data Sim needs.

---

### 6.7 Modifier: Positional Scarcity

**Assumption:** a player's value should reflect how hard they are to replace
at their eligible slot. A **modifier** composing over any base method.

**Two variants considered:**

1. **Within-group standardization.** Compute the base method's category
   primitives within position groups. Rejected: forks the primitive
   computation per position and breaks cross-position comparability.
2. **Positional replacement premium.** Keep the global base value and
   subtract a position-specific replacement level — the positional variant of
   §6.5. **Chosen**, since it composes with any base method.

**Multi-position eligibility:** a player eligible at several slots is valued
at the slot that **maximizes their value** — equivalently, the eligible
position with the **lowest** replacement level. A scarce position has a _low_
replacement level (the last rostered center is worse than the last rostered
guard), and subtracting the lowest baseline credits the player for being able
to fill the thinnest slot. (v0.1 stated the opposite — highest replacement
level — which systematically undervalues multi-eligible players.)

**Inputs:** base method output, player position eligibility
(`Player.position` from Balldontlie for v1 — single string, e.g. "F-C",
parsed into eligible groups G/F/C), roster slot structure.

**Config:** `positionSource`, `slots`, `multiPositionRule: 'maxValue'`.

## 7. Config surface

One config object drives every method. The method-specific part is a
discriminated union so illegal configs are unrepresentable and the method
dispatcher is an exhaustive, compiler-checked `switch`. Type aliases only —
this repo bans `interface`.

```typescript
type CountingCategory = "pts" | "reb" | "ast" | "stl" | "blk" | "tpm" | "tov";
type RatioCategory = "fg" | "ft";
type Category = CountingCategory | RatioCategory;

type LeagueSettings = {
  format: "h2hCategories" | "roto" | "points";
  teams: number; // default 12
  rosterSlots: number; // default 13
  slots?: Record<string, number>; // positional structure, positional modifier only
};

type MethodConfig =
  | { method: "zscore" }
  | { method: "gscore"; gamesBasis?: number }
  | { method: "sgp"; denominators: Partial<Record<Category, number>> }
  | { method: "points"; scoring: Record<string, number> };

type ModifierConfig = {
  replacement?: {
    rule: "lastRostered" | "topFreeAgent";
    budget?: number; // enables auction dollar output
  };
  positional?: {
    multiPositionRule: "maxValue";
  };
};

type ValuationConfig = MethodConfig & {
  categories: Category[]; // default: all 9
  weights: Partial<Record<Category, number>>; // default: 1 each
  basis: "perGame" | "total"; // default: perGame
  league: LeagueSettings;
  modifiers?: ModifierConfig;
};
```

**Weight semantics.** Weights are multiplicative on the per-category
primitive, clamped to `[0, 2]` in steps of 0.25, default 1, **not**
normalized. Totals are therefore only comparable between two configs with the
same weights; the UI must not present cross-config totals as commensurable.

**Punt strategies** are expressed by setting a category weight to 0 or
omitting it from `categories`. Omitting removes the category from the
computation and the display entirely; weight 0 keeps it visible with no
effect on the total. The UI defaults to weight 0 so the user can still see
what they are giving up — which is why the output carries the **raw**
per-category value alongside the weighted contribution (§8).

## 8. Output shape

Every method returns the same shape so the table renders them
interchangeably.

```typescript
type CategoryContribution = {
  raw: number; // unweighted primitive (z, g, sgp, …), sign-corrected
  weighted: number; // raw * weight; sums to total
};

type PlayerValue = {
  playerId: number; // Player.id (Int in Prisma)
  total: number; // sum of weighted contributions (plus modifier shifts)
  breakdown?: Partial<Record<Category, CategoryContribution>>;
  dollars?: number; // present when auction conversion is enabled
  meta?: {
    replacementLevel?: number;
    valuedAtPosition?: string; // positional modifier: the slot used
  };
};
```

- Points-League Linear leaves `breakdown` empty rather than fabricating a
  decomposition (its scoring map is not the category set).
- `rank` is **not** part of the engine output. Rank is a property of a sorted
  view, computed at the presentation layer with a deterministic tie-break:
  `total` descending, then `playerId` ascending. Two equal players never
  flicker order between renders.
- `counting`/`shooting` sub-totals from v0.1 are dropped from the engine
  output; they are trivially derived from `breakdown` by the display layer
  when wanted.

## 9. Technical design

### 9.1 Computation tiers

| Tier | What                                                                                                                                                     | Where  | Cache                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| 1    | Window stat-line fetch (season aggregates or lastN log aggregation)                                                                                      | Server | `unstable_cache` keyed **only** by `range`, tagged `players`, revalidate 300s like the existing search caches |
| 2    | Pool selection, league averages, per-category primitives (μ, σ, impacts), weighted sums, modifier shifts, points scoring, sorting, filtering, pagination | Client | Recomputed on every config change, memoized                                                                   |

_(Phase 1 refinement: pool size depends on `teams × rosterSlots` — user
config — so pool statistics moved to Tier 2 with the reduce, and `basis`
became client-side. The pool math is a few hundred players × 9 categories,
microseconds; the expensive part stays cached and config-free.)_

The governing rule: a per-category primitive does not depend on which
categories are active or how they are weighted, so it is computed once and
cached. Turning off turnovers does not change anyone's points z-score. Only
the final reduce is config-dependent, and that is microseconds for a few
hundred players.

**The cache key must never include user config.** Weights are continuous;
folding them into a cache key makes cardinality unbounded and the cache
useless. Tier 1's key space is `|ranges| × |bases|` — a dozen entries.

### 9.2 Module layout

```
src/lib/valuation/
  index.ts            // public API: computePrimitives / scoreFromPrimitives
  types.ts            // Category, ValuationConfig, PlayerValue, Primitives
  registry.ts         // method metadata: key, label, description, formula,
                      // availability + unavailability reason; drives the UI
  pool.ts             // thresholds, pool selection, refinement pass, league averages
  categories.ts       // category definitions, sign handling, ratio impact
  searchParams.ts     // nuqs parsers/serializers for the Fantasy tab URL state
  methods/
    zscore.ts
    gscore.ts
    sgp.ts
    points.ts
  modifiers/
    replacement.ts    // vorp baseline shift, auction dollars
    positional.ts     // scarcity adjustment, position parsing
```

Each method exports two functions matching the tier split:

```typescript
// Tier 1: config-independent, cached server-side
computePrimitives(args: { pool: PlayerStatLine[]; league: LeagueSettings }): Primitives;

// Tier 2: config-dependent, client-side
scoreFromPrimitives(args: { primitives: Primitives; config: ValuationConfig }): PlayerValue[];
```

Modifiers take a `PlayerValue[]` and return a `PlayerValue[]`, so they compose
over any base method. Every test is co-located per repo convention.

### 9.3 Data dependencies

| Method              | Beyond pool box-score stats                          | Status                                                                               |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Z-Score             | none                                                 | ready                                                                                |
| Points              | league scoring settings (user input)                 | ready                                                                                |
| VORP modifier       | league size and roster slots (user input, defaulted) | ready                                                                                |
| Positional modifier | position eligibility                                 | ready for v1 via `Player.position`; platform slot eligibility is a future refinement |
| G-Score             | per-player per-category game-level variance          | **data ready** (`PlayerGameLog`); gated on formula verification only                 |
| SGP                 | standings-gain denominators                          | **blocked** on a sourced defaults table or user import                               |

There is no data-acquisition work on the critical path. The one genuine
external dependency is SGP's denominator table.

### 9.4 Integration with /players

The Fantasy tab inverts the page's current architecture deliberately: the
existing tabs re-render on the server for every sort click; the Fantasy tab
ships the cached window stat lines to a client component and does everything
config-dependent locally, because "results update instantly" (§3) is a core
requirement and weights are continuous. Payload is small — pool-sized rows ×
one stat line ≈ tens of KB. Config, sort, and pagination state live in the
URL via nuqs so views are shareable; `range` is the only param that requires
new server data and navigates with `shallow: false`; everything the client
can satisfy (method, weights, `mode`/basis, sort, page) uses
`shallow: true`. Logged-in users can later
persist league settings to `Profile`; URL always wins. Full UI specification:
`docs/superpowers/specs/2026-07-23-fantasy-value-tab-design.md`.

## 10. Validation

Correctness here is not self-evident, so beyond unit tests on the arithmetic,
each of these is implemented as an automated test against a fixture snapshot
of a real season, not a manual checklist:

- **Sanity ranking.** Under default 9-cat settings, the top 20 by Z-Score
  closely resembles published consensus rankings. Large divergences indicate
  a bug, not an insight.
- **Punt behavior.** Zeroing FT% measurably raises the rank of known
  poor-shooting bigs; zeroing FG% raises high-volume guards. If not, the
  weighting is not flowing through.
- **Method agreement.** Z-Score and G-Score correlate strongly but not
  perfectly, with G-Score systematically lower for low-minute, high-variance
  specialists. That specific divergence is the signal G-Score is implemented
  correctly.
- **Invariance.** Adding a replacement-level player to the pool barely moves
  anyone's value. Large shifts mean the pool is too small or thresholds too
  loose.
- **Conservation.** Auction dollars sum to exactly `teams * budget` for any
  config (property test across random weight vectors).
- **Determinism.** Equal totals order by `playerId`; two identical runs
  produce identical output.

## 11. Edge cases

- **Zero attempts.** A player with no FGA or FTA gets a neutral shooting
  impact, never a divide by zero.
- **Zero variance category.** If every pool player has the same value in a
  category, σ is 0 and all scores in that category are 0, not undefined.
- **Tiny pool.** Fewer than two players makes σ undefined. Return neutral
  values and surface a notice.
- **Missing denominators or positions.** The dependent method or modifier is
  disabled with an explanatory state (via `registry.ts`), never silently
  defaulted to plausible-looking numbers.
- **Format mismatch.** Selecting Points-League Linear in a category league,
  or a category method in a points league, produces a warning rather than a
  silently meaningless number.
- **All categories excluded.** Guard against an empty category set; return
  zeroes and prompt the user.
- **Injured or zero-game players.** Excluded from the pool by the thresholds
  but still displayed and scored against the pool (§5.1).

## 12. Phasing

Ordered by real data availability and user value; every phase ships behind
the method registry so the UI adapts automatically.

- **Phase 1 — Engine core + Z-Score + the tab.** Greenfield: `lib/valuation/`
  (types, pool, categories, zscore, registry, searchParams), the Tier-1
  cached loader, and the full Fantasy Value tab UI (table, sorting,
  category/weight controls, tooltips, legend) per the design spec. This is
  the largest phase, not a refactor.
- **Phase 2 — Replacement modifier + auction dollars + Points-League
  Linear.** No new data; adds the baseline toggle, budget input, $ column,
  and league-format setting with mismatch warnings.
- **Phase 3 — G-Score.** Data already exists; the deliverable is the verified
  formulation (§6.2 gate), the Welford variance pass in Tier 1, and the
  method's registry entry.
- **Phase 4 — Positional modifier.** Position parsing from `Player.position`,
  per-slot replacement levels, `valuedAtPosition` display.
- **Phase 5 — SGP.** Gated on a sourced denominators table or user-supplied
  denominators. Ships last because it is the only genuinely blocked item.

Sim Value is out of scope for this feature (§6.6) and returns as its own
PRD.

## 13. Open questions

- SGP denominators: which citable source, or do we derive from public league
  archives? (Blocking Phase 5 only.)
- Should logged-in users' league settings persist to `Profile` in Phase 2 or
  wait for demand? (URL-first works regardless.)
- When the platform's real slot-eligibility rules (multi-position) become
  available, does `Player.position` parsing stay as the fallback or get
  replaced?
- Should projections ever be blended in, or does the engine remain strictly a
  function of the supplied stat line? (Current answer: strictly the supplied
  line; revisit post-Phase 5.)
