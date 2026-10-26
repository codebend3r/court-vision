"use client";

import { ChangeEvent, FocusEvent } from "react";

import {
  GAME_RANGE_LABELS,
  isPlayerGameRange,
  isPlayerStatMode,
  MAX_QUERY_LENGTH,
  PLAYER_GAME_RANGES,
  type PlayerGameRange,
  type PlayerStatMode,
} from "@/lib/players/searchParams";
import { useDebouncedQuery } from "@/lib/players/useDebouncedQuery";
import {
  CATEGORY_META,
  DEFAULT_POINTS_SCORING,
  methodMeta,
  SCORED_KEYS,
} from "@vision/sport-basketball/engine";
import { isWeightedMethodKey, METHOD_KEY_BY_WEIGHTED } from "@vision/core/valuation/registry";
import { Disclosure } from "@vision/ui/components/Disclosure/Disclosure";
import {
  LEAGUE_BOUNDS,
  normalizeCount,
  normalizeScore,
  normalizeWeight,
  SCORE_BOUNDS,
  SCORING_LABELS,
  WEIGHT_BOUNDS,
  withoutWeight,
} from "@/lib/leagues/settings";
import { type FantasySortKey } from "@/lib/valuation/searchParams";
import {
  type Category,
  type ScoringSettings,
  type ScoringStatKey,
} from "@vision/sport-basketball/types";

import { OwnerQuickFilter } from "@/components/OwnerQuickFilter/OwnerQuickFilter";
import { type PlayerOwnerFilter } from "@/lib/players/ownerFilter";

import styles from "@/components/FantasyControls/FantasyControls.module.scss";

export type FantasyControlsChange = Partial<{
  q: string;
  page: number;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  owner: PlayerOwnerFilter;
  x: Category[];
  w: Partial<Record<Category, number>>;
  s: ScoringSettings;
  teams: number;
  slots: number;
}>;

export type FantasyControlsProps = {
  q: string;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  owner: PlayerOwnerFilter;
  excluded: readonly Category[];
  weights: Partial<Record<Category, number>>; // the sorted column's set only
  sort: FantasySortKey;
  scoring: ScoringSettings;
  teams: number;
  slots: number;
  onChange: (change: FantasyControlsChange) => void;
};

export function FantasyControls({
  q,
  range,
  mode,
  owner,
  excluded,
  weights,
  sort,
  scoring,
  teams,
  slots,
  onChange,
}: FantasyControlsProps) {
  // Weights are per column: the panel edits the sorted method's set, and it is
  // disabled entirely on columns that never read weights (PL Linear, names).
  const weightTarget = isWeightedMethodKey(sort)
    ? methodMeta({ key: METHOD_KEY_BY_WEIGHTED[sort] })
    : undefined;
  const search = useDebouncedQuery({
    q,
    onCommit: ({ q: query }) => onChange({ q: query, page: 1 }),
  });

  type OnPuntProps = { category: Category };

  const onPunt = ({ category }: OnPuntProps) => {
    const cleared = withoutWeight({ weights, category });
    onChange({ w: weights[category] === 0 ? cleared : { ...cleared, [category]: 0 } });
  };

  type OnExcludeProps = { category: Category };

  const onExclude = ({ category }: OnExcludeProps) => {
    onChange({ x: [...excluded, category], w: withoutWeight({ weights, category }) });
  };

  type OnIncludeProps = { category: Category };

  const onInclude = ({ category }: OnIncludeProps) => {
    onChange({ x: excluded.filter((key) => key !== category) });
  };

  type OnWeightBlurProps = { category: Category };

  const onWeightBlur =
    ({ category }: OnWeightBlurProps) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const snapped = normalizeWeight({ raw: event.target.value });
      const cleared = withoutWeight({ weights, category });
      onChange({ w: snapped === 1 ? cleared : { ...cleared, [category]: snapped } });
    };

  type OnScoringBlurProps = { stat: ScoringStatKey };

  const onScoringBlur =
    ({ stat }: OnScoringBlurProps) =>
    (event: FocusEvent<HTMLInputElement>) => {
      onChange({ s: { ...scoring, [stat]: normalizeScore({ raw: event.target.value, stat }) } });
    };

  // A cleared box falls back to the standard league (12 teams, 13 slots), the
  // same answer the league form, the server, and the URL parser give.
  type OnLeagueBlurProps = { field: "teams" | "slots" };

  const onLeagueBlur =
    ({ field }: OnLeagueBlurProps) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const value = normalizeCount({ raw: event.target.value, bounds: LEAGUE_BOUNDS[field] });
      onChange(field === "teams" ? { teams: value } : { slots: value });
    };

  const includedMeta = CATEGORY_META.filter((meta) => !excluded.some((key) => key === meta.key));
  const excludedMeta = CATEGORY_META.filter((meta) => excluded.some((key) => key === meta.key));

  return (
    <section className={styles.controls}>
      <span className={styles.filters}>
        <input
          type="search"
          defaultValue={q}
          onChange={search.onChange}
          placeholder="Search players…"
          aria-label="Search players"
          maxLength={MAX_QUERY_LENGTH}
          className={styles.search}
        />
        <label className={styles.filterLabel}>
          Games
          <select
            value={range}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              if (!isPlayerGameRange(event.target.value)) return;
              onChange({ range: event.target.value, page: 1 });
            }}
            aria-label="Game range"
            className={styles.select}
          >
            {PLAYER_GAME_RANGES.map((gameRange) => (
              <option key={gameRange} value={gameRange}>
                {GAME_RANGE_LABELS[gameRange]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterLabel}>
          Stats
          <select
            value={mode}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              if (!isPlayerStatMode(event.target.value)) return;
              onChange({ mode: event.target.value, page: 1 });
            }}
            aria-label="Stat display"
            className={styles.select}
          >
            <option value="average">Averages</option>
            <option value="total">Totals</option>
          </select>
        </label>
        <OwnerQuickFilter value={owner} onChange={(next) => onChange({ owner: next, page: 1 })} />
      </span>

      <span className={styles.chips} role="group" aria-label="Categories">
        {includedMeta.map((meta) => {
          const punted = weights[meta.key] === 0;
          return (
            <span key={meta.key} className={styles.chip} data-punted={punted || undefined}>
              <button
                type="button"
                onClick={() => onPunt({ category: meta.key })}
                aria-label={`Punt ${meta.label}`}
                aria-pressed={punted}
                className={styles.chipToggle}
              >
                {meta.label}
              </button>
              <button
                type="button"
                onClick={() => onExclude({ category: meta.key })}
                aria-label={`Exclude ${meta.label}`}
                className={styles.chipRemove}
              >
                ×
              </button>
            </span>
          );
        })}
        {excludedMeta.map((meta) => (
          <span key={meta.key} className={styles.chip} data-excluded="true">
            <button
              type="button"
              onClick={() => onInclude({ category: meta.key })}
              aria-label={`Include ${meta.label}`}
              className={styles.chipToggle}
            >
              + {meta.label}
            </button>
          </span>
        ))}
      </span>

      <Disclosure
        className={styles.disclosure}
        summaryClassName={styles.summary}
        summary={<>Weights{!!weightTarget && ` — ${weightTarget.label}`}</>}
      >
        <span className={styles.disclosureBody}>
          <span className={styles.hint}>
            {weightTarget
              ? `Applies to the ${weightTarget.label} column only. Every method column keeps its ` +
                `own weight set — sorting by another column switches to (and edits) that ` +
                `column's weights.`
              : sort === "points"
                ? "PL Linear ignores weights — it prices the box score with the Scoring table below."
                : "Name sorts rank alphabetically. Sort by a method column to tune its weights."}
          </span>
          {includedMeta.map((meta) => (
            <label key={meta.key} className={styles.stepperLabel}>
              {meta.label}
              <input
                key={`${sort}:${meta.key}:${weights[meta.key] ?? 1}`}
                type="number"
                min={WEIGHT_BOUNDS.min}
                max={WEIGHT_BOUNDS.max}
                step={WEIGHT_BOUNDS.step}
                defaultValue={weights[meta.key] ?? 1}
                onBlur={onWeightBlur({ category: meta.key })}
                disabled={!weightTarget}
                className={styles.stepper}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => onChange({ w: {}, x: [] })}
            disabled={!weightTarget}
            className={styles.reset}
          >
            Reset
          </button>
        </span>
      </Disclosure>

      <Disclosure className={styles.disclosure} summaryClassName={styles.summary} summary="Scoring">
        <span className={styles.disclosureBody}>
          <span className={styles.hint}>
            Fantasy points per stat in a points league. Drives the PL Linear column only; the
            category scores ignore it.
          </span>
          {SCORED_KEYS.map((stat) => (
            <label key={stat} className={styles.stepperLabel}>
              {SCORING_LABELS[stat]}
              <input
                key={`${stat}:${scoring[stat]}`}
                type="number"
                min={SCORE_BOUNDS.min}
                max={SCORE_BOUNDS.max}
                step={0.5}
                defaultValue={scoring[stat]}
                onBlur={onScoringBlur({ stat })}
                className={styles.stepper}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => onChange({ s: DEFAULT_POINTS_SCORING })}
            className={styles.reset}
          >
            Reset
          </button>
        </span>
      </Disclosure>

      <Disclosure className={styles.disclosure} summaryClassName={styles.summary} summary="League">
        <span className={styles.disclosureBody}>
          <span className={styles.hint}>
            Sets the pool size and the VORP replacement rank (teams × roster slots).
          </span>
          <label className={styles.stepperLabel}>
            Teams
            <input
              key={`teams:${teams}`}
              type="number"
              min={LEAGUE_BOUNDS.teams.min}
              max={LEAGUE_BOUNDS.teams.max}
              defaultValue={teams}
              onBlur={onLeagueBlur({ field: "teams" })}
              className={styles.stepper}
            />
          </label>
          <label className={styles.stepperLabel}>
            Roster slots
            <input
              key={`slots:${slots}`}
              type="number"
              min={LEAGUE_BOUNDS.slots.min}
              max={LEAGUE_BOUNDS.slots.max}
              defaultValue={slots}
              onBlur={onLeagueBlur({ field: "slots" })}
              className={styles.stepper}
            />
          </label>
        </span>
      </Disclosure>
    </section>
  );
}
