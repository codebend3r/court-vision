"use client";

import { type ChangeEvent, useId, useMemo } from "react";
import Link from "next/link";
import { useQueryStates } from "nuqs";

import { useValuation } from "@/components/FantasyValueView/useValuation";
import { buildAdvice } from "@/lib/advisor/advice";
import { isOnAnotherTeam } from "@/lib/advisor/owner";
import { advisorParsers } from "@/lib/advisor/searchParams";
import {
  type Advice,
  type AdvisorLeagueData,
  type AdvisorOwner,
  type AdvisorPlayer,
  type TradeOffer,
  type TradeTier,
} from "@/lib/advisor/types";
import {
  GAME_RANGE_LABELS,
  gamesForRange,
  isPlayerGameRange,
  PLAYER_GAME_RANGES,
  type PlayerGameRange,
} from "@/lib/players/searchParams";
import { type FantasyStatLine } from "@/lib/valuation/types";
import { unmatchedNotice } from "@/lib/waiverWire/format";
import { scoreKeysFor } from "@/lib/waiverWire/model";
import { formatOrdinal, formatSigned } from "@vision/core/util/format";
import { type FantasyMethodKey } from "@vision/core/valuation/types";
import { buildCategoryBreakdown } from "@vision/sport-basketball/engine";
import {
  type FantasyCategoryBreakdown,
  type MethodWeights,
  type ValuationConfig,
} from "@vision/sport-basketball/types";

import styles from "@/components/AdvisorView/AdvisorView.module.scss";

export type AdvisorViewProps = {
  // The range the server loaded `lines` for; see WaiverWireView.
  range: PlayerGameRange;
  lines: FantasyStatLine[];
  league: AdvisorLeagueData;
  activePlayerIds: number[];
  config: ValuationConfig;
  methodWeights: MethodWeights;
  method: FantasyMethodKey;
};

export const NO_ADVICE = "No valued players on your roster in this range yet.";

const TIER_TITLES: Record<TradeTier, string> = {
  favors_me: "Favors you",
  fair: "Fair and balanced",
  favors_them: "Favors them",
};

const TIER_HINTS: Record<TradeTier, string> = {
  favors_me: "A reach: you give less than you get. Expect a counter.",
  fair: "About even on value. The likeliest to be accepted.",
  favors_them: "An overpay: you give more than you get, to make sure it happens.",
};

const ONE_PLACE = 1;

type FormatScoreProps = { value: number };

const formatScore = ({ value }: FormatScoreProps): string =>
  formatSigned({ value, digits: ONE_PLACE });

type OwnerTextProps = { owner: AdvisorOwner };

const ownerText = ({ owner }: OwnerTextProps): string => {
  if (owner.kind === "team") return owner.teamName;
  if (owner.kind === "waivers") return "On waivers";
  if (owner.kind === "free_agent") return "Free agent";
  return "Your team";
};

type PlayerNameProps = { player: AdvisorPlayer };

function PlayerName({ player }: PlayerNameProps) {
  const meta = [player.teamAbbr, player.position, player.injuryStatus].flatMap((part) =>
    part ? [part] : [],
  );
  return (
    <span className={styles.player}>
      <Link href={`/players/${player.playerId}`} className={styles.name}>
        {player.fullName}
      </Link>
      {!!meta.length && <span className={styles.meta}>{meta.join(" · ")}</span>}
    </span>
  );
}

// "+1.5 in your favor", "even", "1.5 in their favor".
type BalanceTextProps = { balance: number };

const balanceText = ({ balance }: BalanceTextProps): string => {
  const size = Math.abs(balance).toFixed(ONE_PLACE);
  if (size === (0).toFixed(ONE_PLACE)) return "Even on value";
  return balance < 0 ? `${size} value in your favor` : `${size} value in their favor`;
};

type TradeCardProps = { offer: TradeOffer; label: string; ownerName: string };

function TradeCard({ offer, label, ownerName }: TradeCardProps) {
  return (
    <li className={styles.trade} data-tier={offer.tier}>
      <h4 className={styles.tradeTitle}>{TIER_TITLES[offer.tier]}</h4>
      <p className={styles.hint}>{TIER_HINTS[offer.tier]}</p>
      <dl className={styles.tradeTerms}>
        <dt>You give</dt>
        <dd>
          <ul className={styles.plainList}>
            {offer.give.map((player) => (
              <li key={player.playerId}>
                <PlayerName player={player} />
              </li>
            ))}
          </ul>
        </dd>
        <dt>You get</dt>
        <dd>
          <PlayerName player={offer.get} />
        </dd>
        <dt>Balance</dt>
        <dd>{balanceText({ balance: offer.balance })}</dd>
        <dt>{label} change</dt>
        <dd>{formatScore({ value: offer.categoryChange })}</dd>
      </dl>
      {offer.give.length > 1 && (
        <p className={styles.hint}>{ownerName} would need to drop a player to take two.</p>
      )}
    </li>
  );
}

type AdvicePanelsProps = { advice: Advice };

function AdvicePanels({ advice }: AdvicePanelsProps) {
  const { weakness, target, trades, freeAgents, drop } = advice;
  const label = weakness.label;
  const owner = target?.owner;
  const tradePartner = owner !== undefined && isOnAnotherTeam(owner) ? owner : null;
  const partnerName = tradePartner?.managerName ?? tradePartner?.teamName ?? "They";

  return (
    <>
      <section className={styles.panel} aria-labelledby="advisor-weakness">
        <h2 id="advisor-weakness" className={styles.panelTitle}>
          Biggest weakness
        </h2>
        <p className={styles.readout}>
          <span className={styles.readoutValue}>{label}</span>
          <span className={styles.readoutRank}>
            {formatOrdinal({ value: weakness.rank })} of {weakness.of}
          </span>
        </p>
        <p className={styles.hint}>
          Your healthy roster scores {formatScore({ value: weakness.myTotal })} in {label}; the
          league averages {formatScore({ value: weakness.leagueAverage })}.
        </p>
        <ol className={styles.needs} aria-label="Every category, weakest first">
          {advice.needs.map((need) => (
            <li
              key={need.key}
              className={styles.need}
              data-weakest={need.key === weakness.key || undefined}
            >
              <span className={styles.needLabel}>{need.label}</span>
              <span className={styles.needRank}>
                {formatOrdinal({ value: need.rank })}
                <span className={styles.hint}> of {need.of}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.panel} aria-labelledby="advisor-target">
        <h2 id="advisor-target" className={styles.panelTitle}>
          Best fit for {label}
        </h2>
        {target === null ? (
          <p className={styles.message}>Nobody outside your team is valued in this range.</p>
        ) : (
          <div className={styles.target}>
            <PlayerName player={target} />
            <p className={styles.hint}>
              {ownerText({ owner: target.owner })} · {label}{" "}
              {formatScore({ value: target.categoryScore })} · value{" "}
              {formatScore({ value: target.value })}
            </p>
          </div>
        )}
      </section>

      {target !== null && (
        <section className={styles.panel} aria-labelledby="advisor-trades">
          <h2 id="advisor-trades" className={styles.panelTitle}>
            {tradePartner === null ? "Trade ideas" : `Trade ideas with ${tradePartner.teamName}`}
          </h2>
          {tradePartner === null ? (
            <p className={styles.message}>
              {target.fullName} is not on another team, so no trade is needed: pick them up below.
            </p>
          ) : !trades.length ? (
            <p className={styles.message}>Your roster has nobody valued to offer.</p>
          ) : (
            <>
              <h3 className={styles.srOnly}>Three offers for {target.fullName}</h3>
              <ul className={styles.trades}>
                {trades.map((offer) => (
                  <TradeCard key={offer.tier} offer={offer} label={label} ownerName={partnerName} />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className={styles.panel} aria-labelledby="advisor-free-agents">
        <h2 id="advisor-free-agents" className={styles.panelTitle}>
          Free agents for {label}
        </h2>
        {!freeAgents.length ? (
          <p className={styles.message}>No free agent is valued in this range.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Free agents who help {label}, best in it first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.numeric}>
                    {label}
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Value
                  </th>
                  <th scope="col" className={styles.numeric}>
                    {drop === null ? "Over drop" : `Over ${drop.fullName}`}
                  </th>
                </tr>
              </thead>
              <tbody>
                {freeAgents.map((pick) => (
                  <tr key={pick.playerId}>
                    <th scope="row" className={styles.rowHeader}>
                      <PlayerName player={pick} />
                      {!pick.isUpgrade && (
                        <span className={styles.hint}> Helps {label}, not an overall upgrade</span>
                      )}
                    </th>
                    <td>{ownerText({ owner: pick.owner })}</td>
                    <td className={styles.numeric}>{formatScore({ value: pick.categoryScore })}</td>
                    <td className={styles.numeric}>{formatScore({ value: pick.value })}</td>
                    <td className={styles.numeric}>
                      {pick.gainOverDrop === null ? "-" : formatScore({ value: pick.gainOverDrop })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="advisor-drop">
        <h2 id="advisor-drop" className={styles.panelTitle}>
          Who to drop
        </h2>
        {drop === null ? (
          <p className={styles.message}>Nobody on your healthy roster is valued in this range.</p>
        ) : (
          <div className={styles.target}>
            <PlayerName player={drop} />
            <p className={styles.hint}>
              Value {formatScore({ value: drop.value })}, {label}{" "}
              {formatScore({ value: drop.categoryScore })}. Your lowest-value player once their{" "}
              {label} is counted, so dropping them costs the least.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

// Client orchestrator: values the range's pool once, in the worker, the way
// the Waiver Wire does, then hands it to the advisor engine. Only a new range
// goes back to the server for a new pool.
export function AdvisorView({
  range,
  lines,
  league,
  activePlayerIds,
  config,
  methodWeights,
  method,
}: AdvisorViewProps) {
  const rangeId = useId();
  const [query, setQuery] = useQueryStates(advisorParsers);
  const { valueKey, scoreKey } = scoreKeysFor({ method });
  const valuation = useValuation({
    lines,
    config,
    methodWeights,
    windowGames: gamesForRange({ range }),
  });

  const activeIds = useMemo(() => new Set(activePlayerIds), [activePlayerIds]);
  const linesById = useMemo(
    () => new Map(valuation.lines.map((line) => [line.playerId, line])),
    [valuation.lines],
  );
  const { poolStats, config: settledConfig, methodWeights: settledWeights } = valuation;
  type BreakdownForProps = { playerId: number };

  // Memoized per player: the engine asks for the same breakdown many times.
  const breakdownFor = useMemo(() => {
    const cache = new Map<number, FantasyCategoryBreakdown[]>();
    return ({ playerId }: BreakdownForProps): FantasyCategoryBreakdown[] => {
      const cached = cache.get(playerId);
      if (cached !== undefined) return cached;
      const line = linesById.get(playerId);
      const breakdown = line
        ? buildCategoryBreakdown({
            line,
            poolStats,
            config: settledConfig,
            methodWeights: settledWeights,
          })
        : [];
      cache.set(playerId, breakdown);
      return breakdown;
    };
  }, [linesById, poolStats, settledConfig, settledWeights]);

  const advice = useMemo(
    () =>
      buildAdvice({
        lines: valuation.lines,
        values: valuation.values,
        valueKey,
        league,
        activePlayerIds: activeIds,
        breakdownFor,
        scoreKey,
      }),
    [valuation.lines, valuation.values, valueKey, league, activeIds, breakdownFor, scoreKey],
  );

  const onRange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (!isPlayerGameRange(next)) return;
    void setQuery({ range: next });
  };

  // Quiet while the worker values a new pool; it speaks once the values land.
  const announcement = valuation.isPending
    ? ""
    : advice === null
      ? NO_ADVICE
      : `Biggest weakness: ${advice.weakness.label}, ${formatOrdinal({ value: advice.weakness.rank })} of ${advice.weakness.of}`;

  return (
    <section className={styles.view} aria-label="Roster Advisor" aria-busy={valuation.isPending}>
      <div className={styles.controls}>
        <label className={styles.field} htmlFor={rangeId}>
          Range
          <select id={rangeId} className={styles.select} value={query.range} onChange={onRange}>
            {PLAYER_GAME_RANGES.map((entry) => (
              <option key={entry} value={entry}>
                {GAME_RANGE_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {league.unmatched.length > 0 && (
        <p className={styles.hint}>{unmatchedNotice({ unmatched: league.unmatched })}</p>
      )}
      {advice === null ? (
        <p className={styles.message}>{NO_ADVICE}</p>
      ) : (
        <AdvicePanels advice={advice} />
      )}
      <p role="status" className={styles.srOnly}>
        {announcement}
      </p>
    </section>
  );
}
