"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FocusEvent, type FormEvent, useState } from "react";

import { createLeague, updateLeague } from "@/lib/leagues/actions";
import {
  defaultScoringConfig,
  isH2hCategoriesConfig,
  isH2hPointsConfig,
  isLeagueScoringType,
  isRotoConfig,
  parseScoringConfig,
} from "@/lib/leagues/guards";
import { useLeaguesStore } from "@/lib/leagues/store";
import {
  type LeagueScoringConfig,
  type LeagueScoringType,
  type LeagueSummary,
} from "@/lib/leagues/types";
import { CATEGORY_KEYS, CATEGORY_META } from "@/lib/valuation/categories";
import { DEFAULT_POINTS_SCORING, SCORED_KEYS } from "@/lib/valuation/methods/points";
import { clampScore, snapWeight } from "@/lib/valuation/searchParams";
import { type Category, type ScoringSettings, type ScoringStatKey } from "@/lib/valuation/types";

import styles from "@/components/LeagueForm/LeagueForm.module.scss";

export type LeagueFormProps = {
  league: LeagueSummary | null;
};

type LeagueFormState = {
  name: string;
  scoringType: LeagueScoringType;
  teamCount: number;
  rosterSlots: number;
  categories: Category[];
  weights: Partial<Record<Category, number>>;
  scoring: ScoringSettings;
};

const SCORING_TYPE_OPTIONS: ReadonlyArray<{ value: LeagueScoringType; label: string }> = [
  { value: "h2h_categories", label: "H2H Categories" },
  { value: "h2h_points", label: "H2H Points" },
  { value: "roto", label: "Rotisserie" },
];

// The scoring table is keyed by raw stat, so it needs its own labels — the
// category meta covers 3PM as "tpm" and has no entry for a points-league line.
const SCORING_LABELS: Record<ScoringStatKey, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  fg3m: "3PM",
  tov: "TOV",
};

const TEAMS_MIN = 2;
const TEAMS_MAX = 30;
const TEAMS_DEFAULT = 12;
const SLOTS_MIN = 1;
const SLOTS_MAX = 25;
const SLOTS_DEFAULT = 13;

// Mirrors the server's clamp (lib/leagues/actions.ts): an unparsable/cleared
// field falls back to the same 12/13 defaults, not the field's minimum.
const clampInt = ({
  value,
  min,
  max,
  fallback,
}: {
  value: number;
  min: number;
  max: number;
  fallback: number;
}): number => (Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback);

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

const buildInitialState = ({ league }: { league: LeagueSummary | null }): LeagueFormState => {
  const scoringType = league?.scoringType ?? "h2h_categories";
  const config: LeagueScoringConfig =
    league === null
      ? defaultScoringConfig({ scoringType })
      : parseScoringConfig({ scoringType, value: league.scoringConfig });
  return {
    name: league?.name ?? "",
    scoringType,
    teamCount: league?.teamCount ?? 12,
    rosterSlots: league?.rosterSlots ?? 13,
    categories:
      isH2hCategoriesConfig(config) || isRotoConfig(config)
        ? config.categories
        : [...CATEGORY_KEYS],
    weights: isH2hCategoriesConfig(config) ? (config.weights ?? {}) : {},
    scoring: isH2hPointsConfig(config) ? config.scoring : { ...DEFAULT_POINTS_SCORING },
  };
};

const errorMessageFor = ({
  status,
}: {
  status: "limit" | "invalid" | "unauthenticated" | "error";
}): string => {
  if (status === "limit") return "You already have 10 leagues.";
  if (status === "invalid") return "Check the league name and settings.";
  return "Something went wrong — try again.";
};

// Pressing Enter inside a number field submits the form before that field's
// onBlur fires, so React state (committed on blur) is one edit behind. These
// readers pull the live DOM value straight out of FormData at submit time —
// the field name convention below (`weight:<category>` / `scoring:<stat>`)
// exists purely so this lookup works, and only covers the fields that are
// committed on blur; the name/scoringType/category-checkbox fields are
// already controlled, so `state` for those is never stale.
const readCount = ({
  formData,
  field,
  min,
  max,
  fallback,
}: {
  formData: FormData;
  field: string;
  min: number;
  max: number;
  fallback: number;
}): number => {
  const raw = formData.get(field);
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  return clampInt({ value: parsed, min, max, fallback });
};

const readWeight = ({ formData, category }: { formData: FormData; category: Category }): number => {
  const raw = formData.get(`weight:${category}`);
  const parsed = typeof raw === "string" ? Number.parseFloat(raw) : NaN;
  return snapWeight(parsed);
};

const readScore = ({ formData, stat }: { formData: FormData; stat: ScoringStatKey }): number => {
  const raw = formData.get(`scoring:${stat}`);
  const parsed = typeof raw === "string" ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? clampScore(parsed) : DEFAULT_POINTS_SCORING[stat];
};

// Builds the type-specific config from the live form, dropping weight entries
// equal to 1 (the default) so the stored config stays minimal.
const buildScoringConfig = ({
  state,
  formData,
}: {
  state: LeagueFormState;
  formData: FormData;
}): LeagueScoringConfig => {
  if (state.scoringType === "h2h_points") {
    const scoring = SCORED_KEYS.reduce<ScoringSettings>(
      (acc, stat) => ({ ...acc, [stat]: readScore({ formData, stat }) }),
      { ...DEFAULT_POINTS_SCORING },
    );
    return { scoring };
  }
  if (state.scoringType === "roto") return { categories: state.categories };
  const weights = state.categories.reduce<Partial<Record<Category, number>>>((acc, key) => {
    const weight = readWeight({ formData, category: key });
    return weight === 1 ? acc : { ...acc, [key]: weight };
  }, {});
  return Object.keys(weights).length === 0
    ? { categories: state.categories }
    : { categories: state.categories, weights };
};

export function LeagueForm({ league }: LeagueFormProps) {
  const router = useRouter();
  const [state, setState] = useState<LeagueFormState>(() => buildInitialState({ league }));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setState((prev) => ({ ...prev, name: value }));
  };

  const onScoringTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (!isLeagueScoringType(value)) return;
    setState((prev) => ({ ...prev, scoringType: value }));
  };

  const onCountBlur =
    ({
      field,
      min,
      max,
      fallback,
    }: {
      field: "teamCount" | "rosterSlots";
      min: number;
      max: number;
      fallback: number;
    }) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const value = clampInt({
        value: Number.parseInt(event.target.value, 10),
        min,
        max,
        fallback,
      });
      setState((prev) => ({ ...prev, [field]: value }));
    };

  const toggleCategory = ({ category }: { category: Category }) => {
    const included = state.categories.some((key) => key === category);
    if (included && state.categories.length <= 1) return;
    setState((prev) => ({
      ...prev,
      categories: included
        ? prev.categories.filter((key) => key !== category)
        : [...prev.categories, category],
    }));
  };

  const onWeightBlur =
    ({ category }: { category: Category }) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const snapped = snapWeight(Number.parseFloat(event.target.value));
      setState((prev) => ({
        ...prev,
        weights:
          snapped === 1
            ? withoutWeight({ weights: prev.weights, category })
            : { ...withoutWeight({ weights: prev.weights, category }), [category]: snapped },
      }));
    };

  const onScoringBlur =
    ({ stat }: { stat: ScoringStatKey }) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const parsed = Number.parseFloat(event.target.value);
      const score = Number.isFinite(parsed) ? clampScore(parsed) : DEFAULT_POINTS_SCORING[stat];
      setState((prev) => ({ ...prev, scoring: { ...prev.scoring, [stat]: score } }));
    };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const trimmed = state.name.trim();
    if (trimmed === "") {
      setErrorMessage(errorMessageFor({ status: "invalid" }));
      return;
    }
    // Read the live DOM values (not the onBlur-committed state) so an Enter
    // press — which submits before that field's blur fires — never discards
    // whatever was typed.
    const formData = new FormData(event.currentTarget);
    const teamCount = readCount({
      formData,
      field: "teamCount",
      min: TEAMS_MIN,
      max: TEAMS_MAX,
      fallback: TEAMS_DEFAULT,
    });
    const rosterSlots = readCount({
      formData,
      field: "rosterSlots",
      min: SLOTS_MIN,
      max: SLOTS_MAX,
      fallback: SLOTS_DEFAULT,
    });
    setIsSubmitting(true);
    setErrorMessage(null);
    const payload = {
      name: trimmed,
      scoringType: state.scoringType,
      teamCount,
      rosterSlots,
      scoringConfig: buildScoringConfig({ state, formData }),
    };
    const result =
      league === null
        ? await createLeague(payload)
        : await updateLeague({ leagueId: league.id, ...payload });
    setIsSubmitting(false);
    if (result.status !== "ok") {
      setErrorMessage(errorMessageFor({ status: result.status }));
      return;
    }
    useLeaguesStore.getState().upsert({ league: result.league });
    router.push("/leagues");
    router.refresh();
  };

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {!!errorMessage && (
        <p role="alert" className={styles.error}>
          {errorMessage}
        </p>
      )}

      <label className={styles.field}>
        League name
        <input
          type="text"
          value={state.name}
          onChange={onNameChange}
          className={styles.input}
          maxLength={80}
        />
      </label>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Scoring</legend>
        <div className={styles.radioGroup}>
          {SCORING_TYPE_OPTIONS.map((option) => (
            <label key={option.value} className={styles.radioLabel}>
              <input
                type="radio"
                name="scoringType"
                value={option.value}
                checked={state.scoringType === option.value}
                onChange={onScoringTypeChange}
                className={styles.radio}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.countRow}>
        <label className={styles.field}>
          Teams
          <input
            type="number"
            name="teamCount"
            min={TEAMS_MIN}
            max={TEAMS_MAX}
            key={`teams:${state.teamCount}`}
            defaultValue={state.teamCount}
            onBlur={onCountBlur({
              field: "teamCount",
              min: TEAMS_MIN,
              max: TEAMS_MAX,
              fallback: TEAMS_DEFAULT,
            })}
            className={styles.input}
          />
        </label>
        <label className={styles.field}>
          Roster slots
          <input
            type="number"
            name="rosterSlots"
            min={SLOTS_MIN}
            max={SLOTS_MAX}
            key={`slots:${state.rosterSlots}`}
            defaultValue={state.rosterSlots}
            onBlur={onCountBlur({
              field: "rosterSlots",
              min: SLOTS_MIN,
              max: SLOTS_MAX,
              fallback: SLOTS_DEFAULT,
            })}
            className={styles.input}
          />
        </label>
      </div>

      {state.scoringType === "h2h_points" ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Scoring table</legend>
          <div className={styles.configGrid}>
            {SCORED_KEYS.map((stat) => (
              <label key={stat} className={styles.field}>
                {SCORING_LABELS[stat]}
                <input
                  type="number"
                  name={`scoring:${stat}`}
                  step={0.1}
                  key={`${stat}:${state.scoring[stat]}`}
                  defaultValue={state.scoring[stat]}
                  onBlur={onScoringBlur({ stat })}
                  className={styles.input}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Categories</legend>
          <div className={styles.configGrid}>
            {CATEGORY_META.map((meta) => {
              const checked = state.categories.some((key) => key === meta.key);
              const isOnlyChecked = checked && state.categories.length === 1;
              return (
                <div key={meta.key} className={styles.categoryRow}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isOnlyChecked}
                      onChange={() => toggleCategory({ category: meta.key })}
                      className={styles.checkbox}
                    />
                    {meta.label}
                  </label>
                  {state.scoringType === "h2h_categories" && (
                    <label className={styles.field}>
                      {`${meta.label} weight`}
                      <input
                        type="number"
                        name={`weight:${meta.key}`}
                        min={0}
                        max={2}
                        step={0.25}
                        key={`${meta.key}:${state.weights[meta.key] ?? 1}`}
                        defaultValue={state.weights[meta.key] ?? 1}
                        onBlur={onWeightBlur({ category: meta.key })}
                        disabled={!checked}
                        className={styles.input}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      <button type="submit" className={styles.submit} disabled={isSubmitting}>
        {league === null ? "Create league" : "Save changes"}
      </button>
    </form>
  );
}
