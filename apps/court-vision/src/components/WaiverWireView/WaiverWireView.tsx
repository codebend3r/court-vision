"use client";

import { type ChangeEvent, type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";

import { useValuation } from "@/components/FantasyValueView/useValuation";
import { AvailablePlayersPanel } from "@/components/WaiverWireView/AvailablePlayersPanel";
import { CutLinePanel, NO_FREE_AGENTS } from "@/components/WaiverWireView/CutLinePanel";
import {
  HeadToHeadPanel,
  type HeadToHeadPick,
  NO_PAIR,
} from "@/components/WaiverWireView/HeadToHeadPanel";
import { NO_ROSTER, NO_UPGRADE, SwapBoardPanel } from "@/components/WaiverWireView/SwapBoardPanel";
import { WaiverWireTabs } from "@/components/WaiverWireView/WaiverWireTabs";
import {
  GAME_RANGE_LABELS,
  gamesForRange,
  isPlayerGameRange,
  PLAYER_GAME_RANGES,
  type PlayerGameRange,
} from "@/lib/players/searchParams";
import { type FantasyStatLine } from "@/lib/valuation/types";
import { buildCutLine, type CutScope } from "@/lib/waiverWire/cutLine";
import { unmatchedNotice } from "@/lib/waiverWire/format";
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
  // The range the server loaded `lines` for. The URL's range runs ahead of it
  // while a new pool loads, so the valuation window follows this one.
  range: PlayerGameRange;
  lines: FantasyStatLine[];
  league: WaiverLeagueData;
  activePlayerIds: number[];
  config: ValuationConfig;
  methodWeights: MethodWeights;
  method: FantasyMethodKey;
};

const POSITION_LABELS: Record<WaiverPosition, string> = { all: "All", G: "G", F: "F", C: "C" };
// The keycaps show the letter; the accessible name spells the group out.
const POSITION_NAMES: Record<WaiverPosition, string> = {
  all: "All",
  G: "Guards",
  F: "Forwards",
  C: "Centers",
};

const COMPARE_HINT = "Compare head-to-head against your weakest player";

// Client orchestrator: values the range's pool once, then slices it into the
// three comparisons. The range, tab, position filter and compared pair live in
// the URL; only a new range goes back to the server for a new pool.
export function WaiverWireView({
  range,
  lines,
  league,
  activePlayerIds,
  config,
  methodWeights,
  method,
}: WaiverWireViewProps) {
  const rangeId = useId();
  const compareHintId = useId();
  const [query, setQuery] = useQueryStates(waiverWireParsers);
  // The cut line opens windowed again whenever its scope, range or position
  // changes, by a control or through the URL (back button): the expansion
  // names the list it opened, and the effect below drops it once that list is
  // no longer the one on screen, so coming back to it opens it windowed too.
  const [expandedCut, setExpandedCut] = useState<string | null>(null);
  const { valueKey, scoreKey } = scoreKeysFor({ method });

  // Scored in a worker. Until it answers, everything below reads the lines,
  // config and weights the settled values came from (`valuation.*`), so the
  // last result stays on screen, marked busy, instead of a half-updated one.
  const valuation = useValuation({
    lines,
    config,
    methodWeights,
    // The pool's own range, never the URL's: valuing the old pool with a new
    // window would flash wrong numbers until the server answers.
    windowGames: gamesForRange({ range }),
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

  const cutKey = `${query.scope}:${query.range}:${query.pos}`;
  const showAll = expandedCut === cutKey;
  useEffect(() => {
    setExpandedCut((current) => (current === cutKey ? current : null));
  }, [cutKey]);
  const cutLine = useMemo(
    () => buildCutLine({ model, scope: query.scope, showAll }),
    [model, query.scope, showAll],
  );
  // The scope's every row, for a sort to order.
  const fullCutLine = useMemo(
    () => buildCutLine({ model, scope: query.scope, showAll: true }),
    [model, query.scope],
  );

  // One sentence for the status region: what the open panel now shows.
  const announcements: Record<WaiverView, () => string> = {
    available: () =>
      model.freePool.length === 1
        ? "1 available player"
        : `${model.freePool.length} available players`,
    swap: () => {
      if (!board.target) return NO_ROSTER;
      const count = board.rows.length;
      if (count === 0) return NO_UPGRADE;
      return count === 1
        ? `1 free agent beats ${board.target.fullName}`
        : `${count} free agents beat ${board.target.fullName}`;
    },
    h2h: () => {
      if (pair && headToHead) return headToHeadSummary({ pair, result: headToHead });
      return model.freePool.length === 0 ? NO_FREE_AGENTS : NO_PAIR;
    },
    cut: () => {
      const visible = cutLine.entries.filter((entry) => entry.kind === "row").length;
      const total = visible + cutLine.hiddenAbove + cutLine.hiddenBelow;
      return `${visible} of ${total} players shown`;
    },
  };
  // Quiet while the worker values a new pool; it speaks once the values land.
  const announcement = valuation.isPending ? "" : announcements[query.view]();

  const onView = ({ view }: { view: WaiverView }) => {
    void setQuery({ view }, { history: "replace" });
  };

  const onPosition = ({ pos }: { pos: WaiverPosition }) => {
    void setQuery({ pos }, { history: "replace" });
  };

  const onScope = ({ scope }: { scope: CutScope }) => {
    void setQuery({ scope }, { history: "replace" });
  };

  const onRange = (event: ChangeEvent<HTMLSelectElement>) => {
    const range = event.target.value;
    if (!isPlayerGameRange(range)) return;
    void setQuery({ range });
  };

  // Opening a free agent always measures them against my weakest again.
  const onCompare = ({ fa }: { fa: number }) => {
    void setQuery({ view: "h2h", fa, mine: null }, { history: "replace" });
  };

  // A select in head-to-head changes one side; the other stays as it is.
  const onPick = (pick: HeadToHeadPick) => {
    void setQuery(pick, { history: "replace" });
  };

  const panels: Record<WaiverView, ReactNode> = {
    // Keyed so a new range or position starts the list from the top again.
    available: (
      <AvailablePlayersPanel
        key={`${query.range}:${query.pos}`}
        freePool={model.freePool}
        linesById={linesById}
        onCompare={onCompare}
        compareHintId={compareHintId}
      />
    ),
    // Keyed so a new range or position opens the board collapsed again.
    swap: (
      <SwapBoardPanel
        key={`${query.range}:${query.pos}`}
        board={board}
        model={model}
        onCompare={onCompare}
        compareHintId={compareHintId}
      />
    ),
    h2h: (
      <HeadToHeadPanel
        pair={pair}
        result={headToHead}
        freePool={model.freePool}
        roster={model.roster}
        onPick={onPick}
      />
    ),
    cut: (
      <CutLinePanel
        cutLine={cutLine}
        fullLine={fullCutLine}
        scope={query.scope}
        onScope={onScope}
        showAll={showAll}
        onShowAll={({ showAll: next }) => setExpandedCut(next ? cutKey : null)}
        onCompare={onCompare}
        compareHintId={compareHintId}
        noStats={model.noStats}
      />
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
        <fieldset className={styles.keycapGroup}>
          <legend className={styles.legend}>Position</legend>
          {WAIVER_POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              className={styles.keycap}
              aria-pressed={query.pos === pos}
              aria-label={POSITION_NAMES[pos]}
              onClick={() => onPosition({ pos })}
            >
              {POSITION_LABELS[pos]}
            </button>
          ))}
        </fieldset>
      </div>
      {league.unmatched.length > 0 && (
        <p className={styles.notice}>{unmatchedNotice({ unmatched: league.unmatched })}</p>
      )}
      <WaiverWireTabs view={query.view} onChange={onView} panels={panels} />
      <p role="status" className={styles.srOnly}>
        {announcement}
      </p>
      {/* Referenced by every free agent's name button; never read on its own. */}
      <span id={compareHintId} hidden>
        {COMPARE_HINT}
      </span>
    </section>
  );
}
