import { cleanup, render, screen, within } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { type ValuationPort } from "@/lib/valuation/valuationClient";

vi.mock("next/navigation", () => ({
  usePathname: () => "/advisor",
  useRouter: () => ({ refresh: vi.fn() }),
}));

// A worker that never answers: the first valuation runs synchronously on mount.
const fakePort: ValuationPort = { post: vi.fn(), listen: () => () => {}, terminate: () => {} };
vi.mock("@/lib/valuation/valuationPort", () => ({ createValuationPort: () => fakePort }));

import {
  AdvisorView,
  type AdvisorViewProps,
  NO_ADVICE,
} from "@/components/AdvisorView/AdvisorView";
import { type AdvisorLeagueData } from "@/lib/advisor/types";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING } from "@vision/sport-basketball/engine";
import { type ValuationConfig } from "@vision/sport-basketball/types";

afterEach(cleanup);

// Two of mine, a rival's star who outdoes both, and four free agents.
const lines = [
  makeStatLine({ playerId: 1, fullName: "Mine Low", position: "G", pts: 200, reb: 100, ast: 50 }),
  makeStatLine({
    playerId: 2,
    fullName: "Mine High",
    position: "F",
    pts: 1200,
    reb: 400,
    ast: 300,
  }),
  makeStatLine({
    playerId: 3,
    fullName: "Rival Star",
    position: "C",
    pts: 1500,
    reb: 600,
    ast: 300,
  }),
  makeStatLine({
    playerId: 4,
    fullName: "Free Guard",
    position: "G",
    pts: 1000,
    reb: 200,
    ast: 400,
  }),
  makeStatLine({
    playerId: 5,
    fullName: "Free Center",
    position: "C",
    pts: 900,
    reb: 600,
    ast: 100,
  }),
  makeStatLine({
    playerId: 6,
    fullName: "Free Forward",
    position: "F",
    pts: 800,
    reb: 400,
    ast: 200,
  }),
  makeStatLine({ playerId: 7, fullName: "Deep Bench", position: "G", pts: 100, reb: 50, ast: 30 }),
];

const league: AdvisorLeagueData = {
  myRoster: [
    { playerId: 1, fullName: "Mine Low", slotType: "BENCH", injuryStatus: null },
    { playerId: 2, fullName: "Mine High", slotType: "UTIL", injuryStatus: null },
  ],
  rosteredPlayerIds: [1, 2, 3],
  waivers: [{ playerId: 5, injuryStatus: null }],
  unmatched: [],
  teams: [
    {
      teamId: "a",
      name: "Team Mine",
      managerName: null,
      isMine: true,
      players: [
        { playerId: 1, slotType: "BENCH", injuryStatus: null },
        { playerId: 2, slotType: "UTIL", injuryStatus: null },
      ],
    },
    {
      teamId: "b",
      name: "Team Rival",
      managerName: "Sam",
      isMine: false,
      players: [{ playerId: 3, slotType: "C", injuryStatus: null }],
    },
  ],
};

const config: ValuationConfig = {
  categories: ["pts", "reb", "ast"],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: { ...DEFAULT_POINTS_SCORING },
};

const props: AdvisorViewProps = {
  range: "all",
  lines,
  league,
  activePlayerIds: [1, 2, 3, 4, 5, 6, 7],
  config,
  methodWeights: {},
  method: "zscore",
};

type RenderViewProps = { overrides?: Partial<AdvisorViewProps> };

const renderView = ({ overrides = {} }: RenderViewProps = {}) =>
  render(<AdvisorView {...props} {...overrides} />, {
    wrapper: withNuqsTestingAdapter({ searchParams: "?" }),
  });

describe("AdvisorView", () => {
  it("names the biggest weakness and ranks every category", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 2, name: "Biggest weakness" })).toBeInTheDocument();
    const needs = screen.getByRole("list", { name: "Every category, weakest first" });
    expect(within(needs).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toMatch(/^Biggest weakness: \w+, 2nd of 2$/);
  });

  it("finds the rival's star and offers three trades for them", () => {
    renderView();
    const target = screen.getByRole("region", { name: /^Best fit for/ });
    expect(within(target).getByRole("link", { name: "Rival Star" })).toBeInTheDocument();
    const trades = screen.getByRole("region", { name: "Trade ideas with Team Rival" });
    expect(
      within(trades)
        .getAllByRole("heading", { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(["Favors you", "Fair and balanced", "Favors them"]);
  });

  it("lists two to five free agents and who to drop", () => {
    renderView();
    const table = within(screen.getByRole("region", { name: /^Free agents for/ })).getByRole(
      "table",
    );
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(table.textContent).not.toContain("Rival Star");
    const drop = screen.getByRole("region", { name: "Who to drop" });
    expect(within(drop).getByRole("link", { name: "Mine Low" })).toBeInTheDocument();
  });

  it("needs no trade when the best fit is a free agent", () => {
    renderView({
      overrides: {
        league: {
          ...league,
          teams: league.teams.map((team) => (team.isMine ? team : { ...team, players: [] })),
          rosteredPlayerIds: [1, 2],
        },
      },
    });
    expect(screen.getByText(/is not on another team, so no trade is needed/)).toBeInTheDocument();
  });

  it("says so when there is nothing to advise", () => {
    renderView({ overrides: { league: { ...league, teams: [] } } });
    expect(screen.getAllByText(NO_ADVICE).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Biggest weakness" })).toBeNull();
  });
});
