"use client";

import { ChangeEvent, FocusEvent, useEffect, useRef } from "react";

import {
  isPlayerGameRange,
  isPlayerStatMode,
  MAX_QUERY_LENGTH,
  type PlayerGameRange,
  type PlayerStatMode,
} from "@/lib/players/searchParams";
import { CATEGORY_KEYS, CATEGORY_META } from "@/lib/valuation/categories";
import { snapWeight } from "@/lib/valuation/searchParams";
import { type Category } from "@/lib/valuation/types";

import styles from "@/components/FantasyControls/FantasyControls.module.scss";

export type FantasyControlsChange = Partial<{
  q: string;
  page: number;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  x: Category[];
  w: Partial<Record<Category, number>>;
  teams: number;
  slots: number;
}>;

export type FantasyControlsProps = {
  q: string;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  excluded: readonly Category[];
  weights: Partial<Record<Category, number>>;
  teams: number;
  slots: number;
  onChange: (change: FantasyControlsChange) => void;
};

const DEBOUNCE_MS = 300;
const TEAMS_MIN = 2;
const TEAMS_MAX = 30;
const SLOTS_MIN = 1;
const SLOTS_MAX = 25;

const withoutWeight = ({
  weights,
  category,
}: {
  weights: Partial<Record<Category, number>>;
  category: Category;
}): Partial<Record<Category, number>> =>
  CATEGORY_KEYS.reduce<Partial<Record<Category, number>>>((acc, key) => {
    const weight = weights[key];
    return key === category || weight === undefined ? acc : { ...acc, [key]: weight };
  }, {});

const clampInt = ({ value, min, max }: { value: number; min: number; max: number }): number =>
  Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : min;

export function FantasyControls({
  q,
  range,
  mode,
  excluded,
  weights,
  teams,
  slots,
  onChange,
}: FantasyControlsProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQ = useRef(q);

  useEffect(() => {
    latestQ.current = q;
  }, [q]);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim().slice(0, MAX_QUERY_LENGTH);
      if (trimmed === latestQ.current) return;
      onChange({ q: trimmed, page: 1 });
    }, DEBOUNCE_MS);
  };

  const onPunt = ({ category }: { category: Category }) => {
    const cleared = withoutWeight({ weights, category });
    onChange({ w: weights[category] === 0 ? cleared : { ...cleared, [category]: 0 } });
  };

  const onExclude = ({ category }: { category: Category }) => {
    onChange({ x: [...excluded, category], w: withoutWeight({ weights, category }) });
  };

  const onInclude = ({ category }: { category: Category }) => {
    onChange({ x: excluded.filter((key) => key !== category) });
  };

  const onWeightBlur =
    ({ category }: { category: Category }) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const snapped = snapWeight(Number.parseFloat(event.target.value));
      const cleared = withoutWeight({ weights, category });
      onChange({ w: snapped === 1 ? cleared : { ...cleared, [category]: snapped } });
    };

  const onLeagueBlur =
    ({ field, min, max }: { field: "teams" | "slots"; min: number; max: number }) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const value = clampInt({ value: Number.parseInt(event.target.value, 10), min, max });
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
          onChange={onSearchChange}
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
            <option value="all">All games</option>
            <option value="last5">Last 5 games</option>
            <option value="last10">Last 10 games</option>
            <option value="last20">Last 20 games</option>
            <option value="last40">Last 40 games</option>
            <option value="last60">Last 60 games</option>
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

      <details className={styles.disclosure}>
        <summary className={styles.summary}>
          <span className={styles.chevron} aria-hidden="true">
            ▸
          </span>
          Weights
        </summary>
        <span className={styles.disclosureBody}>
          <span className={styles.hint}>
            Applies to the category scores: Z-Score, G-Score, VORP, Pos VORP. Points uses
            points-league scoring instead.
          </span>
          {includedMeta.map((meta) => (
            <label key={meta.key} className={styles.stepperLabel}>
              {meta.label}
              <input
                key={`${meta.key}:${weights[meta.key] ?? 1}`}
                type="number"
                min={0}
                max={2}
                step={0.25}
                defaultValue={weights[meta.key] ?? 1}
                onBlur={onWeightBlur({ category: meta.key })}
                className={styles.stepper}
              />
            </label>
          ))}
          <button type="button" onClick={() => onChange({ w: {}, x: [] })} className={styles.reset}>
            Reset
          </button>
        </span>
      </details>

      <details className={styles.disclosure}>
        <summary className={styles.summary}>
          <span className={styles.chevron} aria-hidden="true">
            ▸
          </span>
          League
        </summary>
        <span className={styles.disclosureBody}>
          <span className={styles.hint}>
            Sets the pool size and the VORP replacement rank (teams × roster slots).
          </span>
          <label className={styles.stepperLabel}>
            Teams
            <input
              key={`teams:${teams}`}
              type="number"
              min={TEAMS_MIN}
              max={TEAMS_MAX}
              defaultValue={teams}
              onBlur={onLeagueBlur({ field: "teams", min: TEAMS_MIN, max: TEAMS_MAX })}
              className={styles.stepper}
            />
          </label>
          <label className={styles.stepperLabel}>
            Roster slots
            <input
              key={`slots:${slots}`}
              type="number"
              min={SLOTS_MIN}
              max={SLOTS_MAX}
              defaultValue={slots}
              onBlur={onLeagueBlur({ field: "slots", min: SLOTS_MIN, max: SLOTS_MAX })}
              className={styles.stepper}
            />
          </label>
        </span>
      </details>
    </section>
  );
}
