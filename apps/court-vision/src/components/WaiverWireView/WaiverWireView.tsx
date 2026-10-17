"use client";

import { type ChangeEvent, type ReactNode, useId, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";

import { useValuation } from "@/components/FantasyValueView/useValuation";
import { WaiverWireTabs } from "@/components/WaiverWireView/WaiverWireTabs";
import {
  GAME_RANGE_LABELS,
  gamesForRange,
  isPlayerGameRange,
  PLAYER_GAME_RANGES,
} from "@/lib/players/searchParams";
import { type FantasyStatLine } from "@/lib/valuation/types";
import { buildCutLine } from "@/lib/waiverWire/cutLine";
import { buildHeadToHead, headToHeadSummary, resolvePair } from "@/lib/waiverWire/headToHead";
import { buildWaiverModel, scoreKeysFor } from "@/lib/waiverWire/model";
import {
  WAIVER_POSITIONS,
  waiverWireParsers,
  type WaiverView,
} from "@/lib/waiverWire/searchParams";
import { buildSwapBoard } from "@/lib/waiverWire/swapBoard";
import { type WaiverLeagueData, type WaiverPosition } from "@/lib/waiverWire/types";
import { type FantasyMethodKey } from "@vision/core/valuation/types";
import { buildCategoryBreakdown } from "@vision/sport-basketball/engine";
import {
  type FantasyCategoryBreakdown,
  type MethodWeights,
  type ValuationConfig,
} from "@vision/sport-basketball/types";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

export type WaiverWireViewProps = {
  lines: FantasyStatLine[];
  league: WaiverLeagueData;
  activePlayerIds: number[];
  config: ValuationConfig;
  methodWeights: MethodWeights;
  method: FantasyMethodKey;
};

const POSITION_LABELS: Record<WaiverPosition, string> = { all: "All", G: "G", F: "F", C: "C" };

const NO_PAIR = "Pick a free agent and one of your players to compare.";

// Client orchestrator: values the range's pool once, then slices it into the
// three comparisons. The range, tab, position filter and compared pair live in
// the URL; only a new range goes back to the server for a new pool.
export function WaiverWireView({
  lines,
  league,
  activePlayerIds,
  config,
  methodWeights,
  method,
}: WaiverWireViewProps) {
  const rangeId = useId();
  const [query, setQuery] = useQueryStates(waiverWireParsers);
  const [showAll, setShowAll] = useState(false);
  const { valueKey, scoreKey } = scoreKeysFor({ method });

  // Scored in a worker. Until it answers, everything below reads the lines,
  // config and weights the settled values came from (`valuation.*`), so the
  // last result stays on screen, marked busy, instead of a half-updated one.
  const valuation = useValuation({
    lines,
    config,
    methodWeights,
    windowGames: gamesForRange({ range: query.range }),
  });

  const activeIds = useMemo(() => new Set(activePlayerIds), [activePlayerIds]);
  const linesById = useMemo(
    () => new Map(valuation.lines.map((line) => [line.playerId, line])),
    [valuation.lines],
  );

  const model = useMemo(
    () =>
      buildWaiverModel({
        lines: valuation.lines,
        values: valuation.values,
        valueKey,
        league,
        activePlayerIds: activeIds,
        pos: query.pos,
      }),
    [valuation.lines, valuation.values, valueKey, league, activeIds, query.pos],
  );

  // One player's category breakdown against the settled pool. A player with
  // no line in the range has none.
  const { poolStats, config: settledConfig, methodWeights: settledWeights } = valuation;
  const breakdownFor = useMemo(
    () =>
      ({ playerId }: { playerId: number }): FantasyCategoryBreakdown[] => {
        const line = linesById.get(playerId);
        return line
          ? buildCategoryBreakdown({
              line,
              poolStats,
              config: settledConfig,
              methodWeights: settledWeights,
            })
          : [];
      },
    [linesById, poolStats, settledConfig, settledWeights],
  );

  const board = useMemo(
    () => buildSwapBoard({ model, breakdownFor, scoreKey }),
    [model, breakdownFor, scoreKey],
  );

  const pair = useMemo(
    () => resolvePair({ model, swapTop: board.rows[0] ?? null, fa: query.fa, mine: query.mine }),
    [model, board, query.fa, query.mine],
  );
  const headToHead = useMemo(
    () =>
      pair
        ? buildHeadToHead({
            pair,
            linesById,
            rosterIds: model.roster.map((row) => row.playerId),
            breakdownFor,
            scoreKey,
          })
        : null,
    [pair, linesById, model, breakdownFor, scoreKey],
  );

  const cutLine = useMemo(
    () => buildCutLine({ model, scope: query.scope, showAll }),
    [model, query.scope, showAll],
  );

  const onView = ({ view }: { view: WaiverView }) => {
    void setQuery({ view }, { history: "replace" });
  };

  const onPosition = ({ pos }: { pos: WaiverPosition }) => {
    void setQuery({ pos }, { history: "replace" });
  };

  const onRange = (event: ChangeEvent<HTMLSelectElement>) => {
    const range = event.target.value;
    if (isPlayerGameRange(range)) void setQuery({ range });
  };

  // Opening a free agent always measures them against my weakest again.
  const onCompare = ({ fa }: { fa: number }) => {
    void setQuery({ view: "h2h", fa, mine: null }, { history: "replace" });
  };

  // Stand-ins until the swap board, head-to-head and cut line panels land.
  const panels: Record<WaiverView, ReactNode> = {
    swap: (
      <ul className={styles.list}>
        {board.rows.map((row) => (
          <li key={row.playerId}>
            <button
              type="button"
              className={styles.pick}
              onClick={() => onCompare({ fa: row.playerId })}
            >
              {row.fullName}
            </button>
          </li>
        ))}
      </ul>
    ),
    h2h: (
      <p className={styles.note}>
        {pair && headToHead ? headToHeadSummary({ pair, result: headToHead }) : NO_PAIR}
      </p>
    ),
    cut: (
      <>
        <ol className={styles.list}>
          {cutLine.entries.map((entry) =>
            entry.kind === "line" ? (
              <li key="line" className={styles.cutRule}>
                Cut line · your worst player
              </li>
            ) : (
              <li key={entry.row.playerId}>{entry.row.fullName}</li>
            ),
          )}
        </ol>
        {!showAll && cutLine.hiddenAbove + cutLine.hiddenBelow > 0 && (
          <button type="button" className={styles.pick} onClick={() => setShowAll(true)}>
            Show all
          </button>
        )}
      </>
    ),
  };

  return (
    <section className={styles.view} aria-label="Waiver Wire" aria-busy={valuation.isPending}>
      <div className={styles.controls}>
        <label className={styles.field} htmlFor={rangeId}>
          Range
          <select id={rangeId} className={styles.select} value={query.range} onChange={onRange}>
            {PLAYER_GAME_RANGES.map((range) => (
              <option key={range} value={range}>
                {GAME_RANGE_LABELS[range]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className={styles.positions}>
          <legend className={styles.legend}>Position</legend>
          {WAIVER_POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              className={styles.position}
              aria-pressed={query.pos === pos}
              onClick={() => onPosition({ pos })}
            >
              {POSITION_LABELS[pos]}
            </button>
          ))}
        </fieldset>
      </div>
      <WaiverWireTabs view={query.view} onChange={onView} panels={panels} />
    </section>
  );
}
