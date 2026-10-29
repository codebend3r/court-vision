import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

type LineProps = { playerId: number; fullName: string; pts: number; reb: number; ast: number };

const line = ({ playerId, fullName, pts, reb, ast }: LineProps) =>
  makeStatLine({ playerId, fullName, position: "F", pts, reb, ast });

// Four of mine (one weak, three solid), a rival's star who outdoes each of
// them, and four free agents.
const lines = [
  line({ playerId: 1, fullName: "Mine Low", pts: 200, reb: 100, ast: 50 }),
  line({ playerId: 2, fullName: "Mine High", pts: 1200, reb: 400, ast: 300 }),
  line({ playerId: 8, fullName: "Mine Mid", pts: 1100, reb: 350, ast: 300 }),
  line({ playerId: 9, fullName: "Mine Role", pts: 1000, reb: 300, ast: 300 }),
  line({ playerId: 3, fullName: "Rival Star", pts: 1500, reb: 600, ast: 300 }),
  line({ playerId: 4, fullName: "Free Guard", pts: 1000, reb: 200, ast: 400 }),
  line({ playerId: 5, fullName: "Free Center", pts: 900, reb: 600, ast: 100 }),
  line({ playerId: 6, fullName: "Free Forward", pts: 800, reb: 400, ast: 200 }),
  line({ playerId: 7, fullName: "Deep Bench", pts: 100, reb: 50, ast: 30 }),
];
const MINE = [1, 2, 8, 9];

// Free Forward's last ten games are far better than their season; Deep
// Bench's are worse.
const trendLines = {
  season: lines.filter(({ playerId }) => playerId >= 4 && playerId <= 7),
  recent: [
    makeStatLine({
      playerId: 6,
      fullName: "Free Forward",
      gamesPlayed: 10,
      pts: 400,
      reb: 150,
      ast: 80,
    }),
    makeStatLine({ playerId: 7, fullName: "Deep Bench", gamesPlayed: 10, pts: 5, reb: 5, ast: 2 }),
  ],
};

const league: AdvisorLeagueData = {
  myRoster: MINE.map((playerId) => ({
    playerId,
    fullName: `Player ${playerId}`,
    slotType: "BENCH",
    injuryStatus: null,
  })),
  rosteredPlayerIds: [...MINE, 3],
  waivers: [{ playerId: 5, injuryStatus: null }],
  unmatched: [],
  teams: [
    {
      teamId: "a",
      name: "Team Mine",
      managerName: null,
      isMine: true,
      players: MINE.map((playerId) => ({ playerId, slotType: "BENCH", injuryStatus: null })),
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
  trendLines,
  league,
  activePlayerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  config,
  methodWeights: {},
  method: "zscore",
};

type RenderViewProps = { overrides?: Partial<AdvisorViewProps>; searchParams?: string };

const renderView = ({ overrides = {}, searchParams = "?" }: RenderViewProps = {}) =>
  render(<AdvisorView {...props} {...overrides} />, {
    wrapper: withNuqsTestingAdapter({ searchParams, hasMemory: true }),
  });

describe("AdvisorView", () => {
  it("names the biggest weakness and ranks every category", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 2, name: "Biggest weakness" })).toBeInTheDocument();
    const needs = screen.getByRole("list", { name: "Every category, weakest first" });
    expect(within(needs).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toMatch(/^Biggest weakness: \w+, 2nd of 2$/);
    const target = screen.getByRole("region", { name: /^Best fit for/ });
    expect(within(target).getByRole("link", { name: "Rival Star" })).toBeInTheDocument();
  });

  it("opens on the Trades tab with three options in each of three rows", () => {
    renderView();
    expect(
      screen.getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("aria-selected")]),
    ).toEqual([
      ["Trades", "true"],
      ["Free agent pickups", "false"],
      ["Trending", "false"],
    ]);
    const panel = screen.getByRole("tabpanel", { name: "Trades" });
    ["Favors you", "Fair and balanced", "Favors them"].forEach((tier) => {
      const row = within(panel).getByRole("region", { name: tier });
      expect(
        within(row)
          .getAllByRole("heading", { level: 4 })
          .map((h) => h.textContent),
      ).toEqual(["Option 1", "Option 2", "Option 3"]);
    });
  });

  it("lists two to five free agents and who to drop on its own tab", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("tab", { name: "Free agent pickups" }));
    const panel = screen.getByRole("tabpanel", { name: "Free agent pickups" });
    const rows = within(within(panel).getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(panel.textContent).not.toContain("Rival Star");
    const drop = within(panel).getByRole("region", { name: "Who to drop" });
    expect(within(drop).getByRole("link", { name: "Mine Low" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Favors you" })).toBeNull();
  });

  it("lists free agents trending up on the Trending tab", () => {
    renderView({ searchParams: "?tab=trending" });
    const panel = screen.getByRole("tabpanel", { name: "Trending" });
    const rows = within(within(panel).getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("link").textContent)).toEqual(["Free Forward"]);
  });

  it("needs no trade when the best fit is a free agent", () => {
    renderView({
      overrides: {
        league: {
          ...league,
          teams: league.teams.map((team) => (team.isMine ? team : { ...team, players: [] })),
          rosteredPlayerIds: MINE,
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
