import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { TradesPanel } from "@/components/AdvisorView/TradesPanel";
import { player } from "@/lib/advisor/fixture";
import { type TradeGroup, type TradeOffer, type TradeTier } from "@/lib/advisor/types";

afterEach(cleanup);

const OTHER = { kind: "team", teamId: "t2", teamName: "Team Two", managerName: "Sam" } as const;
const TARGET = player({ playerId: 100, value: 8, owner: OTHER });

type OfferProps = { tier: TradeTier; ids: number[]; balance: number; reachesTier?: boolean };

const offer = ({ tier, ids, balance, reachesTier = true }: OfferProps): TradeOffer => ({
  tier,
  give: ids.map((playerId) => player({ playerId, value: 1 })),
  get: TARGET,
  balance,
  reachesTier,
  categoryChange: 1,
});

const GROUPS: TradeGroup[] = [
  {
    tier: "favors_me",
    offers: [
      offer({ tier: "favors_me", ids: [1], balance: -3 }),
      offer({ tier: "favors_me", ids: [2], balance: -2.5 }),
      offer({ tier: "favors_me", ids: [3], balance: -2, reachesTier: false }),
    ],
  },
  { tier: "fair", offers: [offer({ tier: "fair", ids: [4, 5], balance: 0 })] },
  {
    tier: "favors_them",
    offers: [offer({ tier: "favors_them", ids: [6, 7, 8], balance: 1, reachesTier: false })],
  },
];

describe("TradesPanel", () => {
  it("gives each kind of trade its own row of numbered options", () => {
    render(<TradesPanel target={TARGET} trades={GROUPS} label="REB" />);
    const mine = screen.getByRole("region", { name: "Favors you" });
    expect(
      within(mine)
        .getAllByRole("heading", { level: 4 })
        .map((h) => h.textContent),
    ).toEqual(["Option 1", "Option 2", "Option 3"]);
    expect(within(mine).getByText(/^Reaches:/)).toBeInTheDocument();
    // Only the one card outside the band says so.
    expect(within(mine).getAllByText(/^Barely in your favor/)).toHaveLength(1);
  });

  it("says a row's miss once when none of its options reach the band", () => {
    render(<TradesPanel target={TARGET} trades={GROUPS} label="REB" />);
    const theirs = screen.getByRole("region", { name: "Favors them" });
    expect(within(theirs).getByText(/can't overpay for this player/)).toBeInTheDocument();
    expect(within(theirs).queryByText(/^Barely an overpay/)).toBeNull();
    expect(
      within(theirs).getByText("Sam would need to drop 2 players to take 3."),
    ).toBeInTheDocument();
  });

  it("needs no trade for a free agent", () => {
    render(
      <TradesPanel
        target={player({ playerId: 9, value: 3, owner: { kind: "free_agent" } })}
        trades={[]}
        label="REB"
      />,
    );
    expect(screen.getByText(/no trade is needed/)).toBeInTheDocument();
  });
});
