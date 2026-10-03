import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const loadFantasyTrendLogs = vi.fn();

vi.mock("@/lib/valuation/actions", () => ({ loadFantasyTrendLogs }));

import { FantasyValueView } from "@/components/FantasyValueView/FantasyValueView";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { makeStatLine, type FixtureOverrides } from "@/lib/valuation/fixtures";
import { type FantasyStatLine } from "@/lib/valuation/types";

afterEach(cleanup);

const line = (overrides: FixtureOverrides): FantasyStatLine =>
  makeStatLine({
    firstName: `First${overrides.playerId}`,
    lastName: `Last${overrides.playerId}`,
    fullName: `First${overrides.playerId} Last${overrides.playerId}`,
    ...overrides,
  });

// Alpha: elite scorer, dreadful high-volume FT shooter. Beta: good scorer,
// elite FT shooter. With FT% active Beta outranks Alpha on Z-Score; punting
// FT% flips it.
const alpha = line({
  playerId: 1,
  firstName: "Alpha",
  lastName: "Big",
  fullName: "Alpha Big",
  pts: 1400,
  ftm: 100,
  fta: 300,
});
const beta = line({
  playerId: 2,
  firstName: "Beta",
  lastName: "Guard",
  fullName: "Beta Guard",
  pts: 1100,
  ftm: 280,
  fta: 300,
});
const fillers = [3, 4, 5, 6].map((playerId) => line({ playerId }));
const lines = [alpha, beta, ...fillers];

const renderView = ({
  searchParams = "?",
  onUrlUpdate,
  lines: statLines = lines,
}: {
  searchParams?: string;
  onUrlUpdate?: (event: { queryString: string }) => void;
  lines?: FantasyStatLine[];
} = {}) =>
  render(
    <ThemeProvider>
      <FantasyValueView isSignedIn={false} lines={statLines} />
    </ThemeProvider>,
    { wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate }) },
  );

const firstDataRow = (): HTMLElement => {
  const table = screen.getByRole("table");
  const rows = within(table).getAllByRole("row");
  const first = rows[1];
  if (first === undefined) throw new Error("no data rows rendered");
  return first;
};

// Declared first on purpose: next/dynamic caches a module once it loads, so
// only the first chart-layout mount in this file sees the loading fallback.
describe("FantasyValueView chart layout loading", () => {
  it("shows a loading status while the category charts load, then the charts", async () => {
    renderView({ searchParams: "?layout=categories" });

    expect(screen.getByRole("status")).toHaveTextContent("Loading category charts");
    expect(await screen.findByRole("list", { name: "Fantasy value charts" })).toBeInTheDocument();
    expect(screen.queryByText("Loading category charts")).not.toBeInTheDocument();
  });
});

describe("FantasyValueView", () => {
  it("renders every player sorted by Z-Score descending by default", () => {
    renderView();
    expect(screen.getByText("Showing 1–6 of 6")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Z-Score/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(within(firstDataRow()).getByText("Beta")).toBeInTheDocument();
  });

  it("re-ranks the Z-Score sort when FT% is punted via its chip", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: "Punt FT%" }));
    expect(within(firstDataRow()).getByText("Alpha")).toBeInTheDocument();
  });

  it("sorts by another method column on header click", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: /PL Linear/ }));
    expect(screen.getByRole("columnheader", { name: /PL Linear/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    // Alpha's 28 points per game lead the PL Linear column despite the FT drag.
    expect(within(firstDataRow()).getByText("Alpha")).toBeInTheDocument();
  });

  it("filters by the q param client-side", () => {
    renderView({ searchParams: "?q=Alpha" });
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("clamps an out-of-range page", () => {
    renderView({ searchParams: "?page=99" });
    expect(screen.getAllByText("Page 1 of 1").length).toBeGreaterThan(0);
  });

  it("orders ties deterministically by playerId", () => {
    renderView({ searchParams: "?q=First" }); // the four identical fillers
    const table = screen.getByRole("table");
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("link")[0]?.textContent ?? "");
    expect(names).toEqual(["First3", "First4", "First5", "First6"]);
  });

  it("notices a tiny pool and stays neutral", () => {
    render(<FantasyValueView isSignedIn={false} lines={[alpha]} />, {
      wrapper: withNuqsTestingAdapter({ searchParams: "?" }),
    });
    expect(screen.getByText(/pool is too small/i)).toBeInTheDocument();
  });

  it("prompts when every category is excluded", () => {
    renderView({ searchParams: "?x=pts,reb,ast,stl,blk,tpm,tov,fg,ft" });
    expect(screen.getByText(/add a category/i)).toBeInTheDocument();
  });

  it("renders the empty state without players", () => {
    render(<FantasyValueView isSignedIn={false} lines={[]} />, {
      wrapper: withNuqsTestingAdapter({ searchParams: "?" }),
    });
    expect(screen.getByText(/No players yet/)).toBeInTheDocument();
  });
});

describe("FantasyValueView league seed", () => {
  it("seeds the URL from leagueSeed once on mount", async () => {
    const updates: string[] = [];
    render(<FantasyValueView isSignedIn={false} lines={lines} leagueSeed={{ teams: 10 }} />, {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?",
        onUrlUpdate: (event) => updates.push(event.queryString),
      }),
    });
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).toContain("teams=10");
  });

  it("does not write to the URL when leagueSeed is empty", async () => {
    const updates: string[] = [];
    render(<FantasyValueView isSignedIn={false} lines={lines} leagueSeed={{}} />, {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?",
        onUrlUpdate: (event) => updates.push(event.queryString),
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updates).toHaveLength(0);
  });
});

describe("FantasyValueView per-column weights", () => {
  const astStepper = (): HTMLElement => {
    const details = [...document.querySelectorAll("details")].find((element) =>
      (element.querySelector("summary")?.textContent ?? "").includes("Weights"),
    );
    if (!(details instanceof HTMLElement)) throw new Error("weights section not found");
    return within(details).getByRole("spinbutton", { name: "AST" });
  };

  it("shows the sorted column's own weight", () => {
    renderView({ searchParams: "?sort=z&w=z.ast:2" });
    expect(astStepper()).toHaveValue(2);
  });

  it("resets the panel to 1 when sorting by a column with no stored weights", () => {
    renderView({ searchParams: "?sort=g&w=z.ast:2" });
    expect(astStepper()).toHaveValue(1);
  });

  it("keeps each column's stored weights when another column is edited", async () => {
    const user = userEvent.setup();
    const updates: string[] = [];
    render(<FantasyValueView isSignedIn={false} lines={lines} />, {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?sort=g&w=z.ast:2",
        onUrlUpdate: (event) => updates.push(event.queryString),
      }),
    });
    const stepper = astStepper();
    await user.clear(stepper);
    await user.type(stepper, "0.5");
    await user.tab();
    // G-Score's new weight lands beside Z-Score's untouched one.
    expect(updates.at(-1)).toContain("w=z.ast:2,g.ast:0.5");
  });

  it("only reweights the sorted column's scores", () => {
    // Punting every category for Z-Score zeroes the Z column; G-Score keeps
    // its own unweighted totals.
    renderView({
      searchParams:
        "?sort=z&w=" +
        ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"]
          .map((category) => `z.${category}:0`)
          .join(","),
    });
    const row = firstDataRow();
    const cells = within(row).getAllByRole("cell");
    // With every Z weight at 0, the whole Z column ties at 0.0 — while G-Score
    // still separates players, proving the punt did not leak across columns.
    expect(cells.some((cell) => cell.textContent === "0.0")).toBe(true);
  });
});

describe("FantasyValueView layouts", () => {
  it("renders the table by default with the Table keycap pressed", () => {
    renderView();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Categories" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders one chart row per player instead of the table under layout=categories", async () => {
    renderView({ searchParams: "?layout=categories" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Fantasy value charts" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(lines.length);
    expect(screen.getByText("Showing 1–6 of 6")).toBeInTheDocument();
  });

  it("switches to the categories layout from the keycap and writes it to the URL", async () => {
    const user = userEvent.setup();
    const updates: string[] = [];
    renderView({ onUrlUpdate: (event) => updates.push(event.queryString) });

    await user.click(screen.getByRole("button", { name: "Categories" }));

    expect(updates.at(-1)).toContain("layout=categories");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "Fantasy value charts" })).toBeInTheDocument();
  });

  it("sorts from the chart headers with the same URL state as the table", async () => {
    const user = userEvent.setup();
    const updates: string[] = [];
    renderView({
      searchParams: "?layout=categories",
      onUrlUpdate: (event) => updates.push(event.queryString),
    });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await screen.findByRole("list", { name: "Fantasy value charts" });

    await user.click(screen.getByRole("button", { name: /G-Score/ }));

    expect(updates.at(-1)).toContain("sort=g");
  });

  it("drops excluded categories from the chart bands", async () => {
    renderView({ searchParams: "?layout=categories&x=ft" });
    const charts = within(await screen.findByRole("region", { name: "Fantasy value charts" }));
    expect(charts.queryByText("FT%")).not.toBeInTheDocument();
    expect(charts.getByText("FG%")).toBeInTheDocument();
  });
});

// Thirty games for the two named players (enough to fill the rolling window
// across a 20-game chart), three for everyone else.
const serializedLog = ({ day }: { day: number }) => ({
  gameDate: new Date(Date.UTC(2026, 0, day)).toISOString(),
  minutes: 34,
  pts: 28,
  reb: 8,
  ast: 6,
  stl: 1,
  blk: 1,
  fg3m: 3,
  tov: 3,
  fgm: 10,
  fga: 20,
  ftm: 5,
  fta: 6,
});

const trendLogsFor = ({ playerIds }: { playerIds: readonly number[] }) => ({
  status: "ok" as const,
  players: playerIds.map((playerId) => ({
    playerId,
    logs: Array.from({ length: playerId <= 2 ? 30 : 3 }, (_, index) =>
      serializedLog({ day: index + 1 }),
    ),
  })),
});

describe("FantasyValueView rolling layout", () => {
  beforeEach(() => {
    loadFantasyTrendLogs.mockReset();
    loadFantasyTrendLogs.mockImplementation(({ playerIds }: { playerIds: number[] }) =>
      Promise.resolve(trendLogsFor({ playerIds })),
    );
  });

  // The rolling rows suspend on mount (`use` on the logs promise), and React
  // only retries a tree that suspended inside an awaited act scope.
  const renderRolling = ({ searchParams = "?layout=rolling" } = {}) =>
    act(async () => renderView({ searchParams }));

  it("loads the page's game logs once and draws rolling lines for filled windows", async () => {
    const { container } = await renderRolling();

    const list = await screen.findByRole("list", { name: "Fantasy value trends" });
    await waitFor(() => expect(container.querySelectorAll(".recharts-line")).toHaveLength(4));
    expect(within(list).getAllByRole("listitem")).toHaveLength(lines.length);
    expect(loadFantasyTrendLogs).toHaveBeenCalledTimes(1);
    const [args] = loadFantasyTrendLogs.mock.calls[0] ?? [];
    expect(args).toEqual({ playerIds: expect.arrayContaining([1, 2, 3, 4, 5, 6]) });
    expect(screen.getAllByText(/needs 10 games/i)).toHaveLength(4);
  });

  it("reuses loaded logs when sorting, reweighting, and switching layouts without changing players", async () => {
    const { container } = await renderRolling();
    await waitFor(() => expect(container.querySelectorAll(".recharts-line")).toHaveLength(4));

    await act(async () => {
      screen.getByRole("button", { name: /G-Score/ }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Punt FT%" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Categories" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Rolling" }).click();
    });

    expect(loadFantasyTrendLogs).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/loading rolling value/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(4);
  });

  it("loads a new player set on paging and never shows the previous page's logs", async () => {
    const pageLines = Array.from({ length: 15 }, (_, index) => line({ playerId: index + 1 }));
    await act(async () =>
      renderView({ searchParams: "?layout=rolling&size=10", lines: pageLines }),
    );
    await waitFor(() => expect(loadFantasyTrendLogs).toHaveBeenCalledTimes(1));
    loadFantasyTrendLogs.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      screen.getAllByRole("button", { name: "Next" })[0].click();
    });

    expect(loadFantasyTrendLogs).toHaveBeenCalledTimes(2);
    expect(loadFantasyTrendLogs).toHaveBeenLastCalledWith({ playerIds: [11, 12, 13, 14, 15] });
    expect(screen.getAllByText(/loading rolling value/i)).toHaveLength(5);
  });

  it("refreshes logs when a new server pool arrives for the same player set", async () => {
    const { rerender } = await renderRolling();
    expect(loadFantasyTrendLogs).toHaveBeenCalledTimes(1);

    await act(async () =>
      rerender(
        <ThemeProvider>
          <FantasyValueView isSignedIn={false} lines={[...lines]} />
        </ThemeProvider>,
      ),
    );

    expect(loadFantasyTrendLogs).toHaveBeenCalledTimes(2);
  });

  it("charts each player's last 20 games by default, numbered by game in the season", async () => {
    await renderRolling();

    expect(await screen.findAllByText("Game 11")).toHaveLength(2);
    expect(screen.getAllByText("Game 30")).toHaveLength(2);
    const trends = within(screen.getByRole("region", { name: "Fantasy value trends" }));
    expect(trends.getByText("Last 20 games")).toBeInTheDocument();
  });

  it("follows a Games window the filter names", async () => {
    await renderRolling({ searchParams: "?layout=rolling&range=last5" });

    expect(await screen.findAllByText("Game 26")).toHaveLength(2);
    expect(screen.getAllByText("Game 30")).toHaveLength(2);
    const trends = within(screen.getByRole("region", { name: "Fantasy value trends" }));
    expect(trends.getByText("Last 5 games")).toBeInTheDocument();
  });

  it("shows loading placeholders until the logs arrive", async () => {
    loadFantasyTrendLogs.mockImplementation(() => new Promise(() => {}));
    await renderRolling();

    expect(await screen.findAllByText(/loading rolling value/i)).toHaveLength(lines.length);
  });

  it("announces a failed log load", async () => {
    loadFantasyTrendLogs.mockResolvedValue({ status: "error" });
    await renderRolling();

    expect(await screen.findByRole("alert")).toHaveTextContent(/game logs/i);
  });

  it("does not fetch game logs for the other layouts", () => {
    renderView({ searchParams: "?layout=categories" });
    renderView();

    expect(loadFantasyTrendLogs).not.toHaveBeenCalled();
  });
});
