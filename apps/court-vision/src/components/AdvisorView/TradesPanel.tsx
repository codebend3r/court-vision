import { PlayerName } from "@/components/AdvisorView/PlayerName";
import { balanceText, formatScore } from "@/lib/advisor/format";
import { isOnAnotherTeam } from "@/lib/advisor/owner";
import {
  type AdvisorPlayer,
  type TradeGroup,
  type TradeOffer,
  type TradeTier,
} from "@/lib/advisor/types";

import styles from "@/components/AdvisorView/AdvisorView.module.scss";

const TIER_TITLES: Record<TradeTier, string> = {
  favors_me: "Favors you",
  fair: "Fair and balanced",
  favors_them: "Favors them",
};

const TIER_HINTS: Record<TradeTier, string> = {
  favors_me: "Reaches: you give less than you get. Expect a counter.",
  fair: "About even on value. The likeliest to be accepted.",
  favors_them: "Overpays: you give more than you get, to make sure it happens.",
};

// On a card outside its tier's band, when others in the row are inside it.
const UNREACHED_HINTS: Record<TradeTier, string> = {
  favors_me: "Barely in your favor: your roster has nothing cheaper to offer.",
  fair: "Not quite even: your roster has nothing nearer.",
  favors_them: "Barely an overpay: your roster can't offer more.",
};

// When no option in the row reaches its band: said once, over the row.
const ROW_UNREACHED_HINTS: Record<TradeTier, string> = {
  favors_me: "Your roster has nothing cheap enough to reach; these give the least it can.",
  fair: "Your roster has nothing near even; these are the nearest it gets.",
  favors_them: "Your roster can't overpay for this player; these give the most it can.",
};

// A tier with no option at all.
const EMPTY_TIER: Record<TradeTier, string> = {
  favors_me: "Nothing on your roster is worth less than the fair offers.",
  fair: "Your roster has nobody valued to offer.",
  favors_them: "Even your best three players together don't outvalue the fair offers.",
};

type TradeCardProps = {
  offer: TradeOffer;
  option: number;
  label: string;
  ownerName: string;
  // Whether the row says the miss once already, so the card needn't.
  isRowUnreached: boolean;
};

function TradeCard({ offer, option, label, ownerName, isRowUnreached }: TradeCardProps) {
  return (
    <li className={styles.trade} data-tier={offer.tier}>
      <h4 className={styles.tradeTitle}>Option {option}</h4>
      {!offer.reachesTier && !isRowUnreached && (
        <p className={styles.hint}>{UNREACHED_HINTS[offer.tier]}</p>
      )}
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
        <p className={styles.hint}>
          {ownerName} would need to drop{" "}
          {offer.give.length === 2 ? "a player" : `${offer.give.length - 1} players`} to take{" "}
          {offer.give.length}.
        </p>
      )}
    </li>
  );
}

export type TradesPanelProps = {
  target: AdvisorPlayer | null;
  trades: readonly TradeGroup[];
  label: string;
};

// One row per kind of trade (favors you, fair, favors them), each with up to
// three options for the target. A target nobody rosters needs no trade.
export function TradesPanel({ target, trades, label }: TradesPanelProps) {
  if (target === null) {
    return <p className={styles.message}>Nobody outside your team is valued in this range.</p>;
  }
  const { owner } = target;
  if (!isOnAnotherTeam(owner)) {
    return (
      <p className={styles.message}>
        {target.fullName} is not on another team, so no trade is needed: pick them up from the free
        agents.
      </p>
    );
  }
  if (!trades.some(({ offers }) => offers.length)) {
    return <p className={styles.message}>Your roster has nobody valued to offer.</p>;
  }
  const ownerName = owner.managerName ?? owner.teamName;
  return (
    <section className={styles.panel} aria-labelledby="advisor-trades">
      <h2 id="advisor-trades" className={styles.panelTitle}>
        Trades for {target.fullName} with {owner.teamName}
      </h2>
      {trades.map(({ tier, offers }) => {
        const isRowUnreached = !!offers.length && !offers.some(({ reachesTier }) => reachesTier);
        const hint = !offers.length
          ? EMPTY_TIER[tier]
          : isRowUnreached
            ? ROW_UNREACHED_HINTS[tier]
            : TIER_HINTS[tier];
        return (
          <section
            key={tier}
            className={styles.tradeRow}
            data-tier={tier}
            aria-labelledby={`advisor-tier-${tier}`}
          >
            <h3 id={`advisor-tier-${tier}`} className={styles.tierTitle}>
              {TIER_TITLES[tier]}
            </h3>
            <p className={styles.hint}>{hint}</p>
            <ul className={styles.trades}>
              {offers.map((offer, index) => (
                <TradeCard
                  key={offer.give.map(({ playerId }) => playerId).join(",")}
                  offer={offer}
                  option={index + 1}
                  label={label}
                  ownerName={ownerName}
                  isRowUnreached={isRowUnreached}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
