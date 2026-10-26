import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { CutLinePanel } from "@/components/WaiverWireView/CutLinePanel";
import { type CutLine, type CutLineEntry, type CutScope } from "@/lib/waiverWire/cutLine";
import { type WaiverRosterEntry, type WaiverRow } from "@/lib/waiverWire/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/waiver-wire",
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

type MakeEntryProps = Partial<WaiverRow> & { playerId: number; isUpgrade?: boolean };

const makeEntry = ({ isUpgrade = false, ...overrides }: MakeEntryProps): CutLineEntry => ({
  kind: "row",
  isUpgrade,
  row: {
    fullName: `Player ${overrides.playerId}`,
    teamAbbr: "DET",
    position: "C",
    nbaPersonId: null,
    value: 0,
    rank: overrides.playerId,
    owner: "mine",
    injuryStatus: null,
    ...overrides,
  },
});

const entries: CutLineEntry[] = [
  makeEntry({ playerId: 2, fullName: "Isaiah Hartenstein", rank: 151, value: 1.12 }),
  makeEntry({
    playerId: 10,
    fullName: "Wendell Carter Jr.",
    rank: 168,
    value: 0.94,
    owner: "free_agent",
    isUpgrade: true,
  }),
  makeEntry({
    playerId: 11,
    fullName: "Daniel Gafford",
    rank: 179,
    value: 0.71,
    owner: "waivers",
    isUpgrade: true,
  }),
  makeEntry({ playerId: 1, fullName: "Paul Reed", rank: 262, value: -0.42, injuryStatus: "Q" }),
  { kind: "line" },
  makeEntry({ playerId: 12, fullName: "Yves Missi", rank: 270, value: -0.51, owner: "free_agent" }),
];

const cutLine: CutLine = { entries, hiddenAbove: 3, hiddenBelow: 7 };

const hidden = makeEntry({
  playerId: 99,
  fullName: "Hidden Star",
  rank: 5,
  value: 3.2,
  owner: "free_agent",
  isUpgrade: true,
});

// Every row of the scope, including the ones the window hides.
const fullLine: CutLine = {
  entries: [hidden, ...entries],
  hiddenAbove: 0,
  hiddenBelow: 0,
};

type RenderPanelProps = {
  line?: CutLine;
  full?: CutLine;
  scope?: CutScope;
  showAll?: boolean;
  noStats?: WaiverRosterEntry[];
};

const renderPanel = ({
  line = cutLine,
  full = fullLine,
  scope = "all",
  showAll = false,
  noStats = [],
}: RenderPanelProps = {}) => {
  type OnScopeProps = { scope: CutScope };

  const onScope = vi.fn<({ scope }: OnScopeProps) => void>();
  type OnShowAllProps = { showAll: boolean };

  const onShowAll = vi.fn<({ showAll }: OnShowAllProps) => void>();
  type OnCompareProps = { fa: number };

  const onCompare = vi.fn<({ fa }: OnCompareProps) => void>();
  render(
    <CutLinePanel
      cutLine={line}
      fullLine={full}
      scope={scope}
      onScope={onScope}
      showAll={showAll}
      onShowAll={onShowAll}
      onCompare={onCompare}
      compareHintId="compare-hint"
      noStats={noStats}
    />,
  );
  return { onScope, onShowAll, onCompare };
};

type RowOfProps = { name: string };

const rowOf = ({ name }: RowOfProps): HTMLElement => {
  const row = screen.getByText(name).closest("tr");
  if (row === null) throw new Error(`expected ${name} in a table row`);
  return row;
};

describe("CutLinePanel", () => {
  it("lists your players with no stats in this range under the table", () => {
    renderPanel({
      noStats: [{ playerId: 3, fullName: "Rookie Stash", slotType: "BENCH", injuryStatus: "O" }],
    });

    const summary = screen.getByText("No stats in this range");
    const details = summary.closest("details");
    if (details === null) throw new Error("expected the summary inside a <details>");
    expect(within(details).getByRole("link", { name: "Rookie Stash" })).toHaveAttribute(
      "href",
      "/players/3",
    );
    expect(within(details).getByText("Out")).toBeInTheDocument();
    // After the table in document order, so it reads under it.
    const table = screen.getByRole("table");
    expect(table.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("leaves the no-stats disclosure out when every player has stats", () => {
    renderPanel();

    expect(screen.queryByText("No stats in this range")).not.toBeInTheDocument();
  });

  it("ranks each player in a rank column", () => {
    renderPanel();

    expect(
      screen.getByRole("table", { name: "Your roster and free agents ranked by value" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("columnheader")
        .map((header) => (header.textContent ?? "").replace(/[▲▼]/g, "")),
    ).toEqual(["Rank", "Player", "Owner", "Value"]);
    expect(within(rowOf({ name: "Isaiah Hartenstein" })).getByText("151")).toHaveClass("numeric");
    expect(within(rowOf({ name: "Yves Missi" })).getByText("−0.51")).toHaveClass("numeric");
  });

  it("draws the cut line as a labelled row spanning the table", () => {
    renderPanel();

    const line = screen.getByRole("row", { name: "Cut line: your worst player" });
    const header = within(line).getByRole("rowheader");
    expect(header).toHaveAttribute("colspan", "4");
    expect(header).toHaveTextContent("Cut line: your worst player");
  });

  it("marks your players with You, a link and the leading bar", () => {
    renderPanel();

    const row = rowOf({ name: "Paul Reed" });
    expect(row).toHaveClass("mine");
    expect(within(row).getByRole("link", { name: "Paul Reed" })).toHaveAttribute(
      "href",
      "/players/1",
    );
    expect(within(row).getByText("You")).toBeInTheDocument();
    expect(within(row).getByText("Questionable")).toBeInTheDocument();
  });

  it("marks upgrades with the word Upgrade as well as a tint", () => {
    renderPanel();

    const carter = rowOf({ name: "Wendell Carter Jr." });
    expect(carter).toHaveClass("upgrade");
    expect(within(carter).getByText("Free agent")).toBeInTheDocument();
    expect(within(carter).getByText("Upgrade")).toBeInTheDocument();

    const gafford = rowOf({ name: "Daniel Gafford" });
    expect(gafford).toHaveClass("upgrade");
    expect(within(gafford).getByText("Waivers")).toBeInTheDocument();
    expect(within(gafford).getByText("Upgrade")).toBeInTheDocument();

    const missi = rowOf({ name: "Yves Missi" });
    expect(missi).not.toHaveClass("upgrade");
    expect(within(missi).queryByText("Upgrade")).not.toBeInTheDocument();
  });

  it("opens head-to-head from a free agent's Compare button", async () => {
    const user = userEvent.setup();
    const { onCompare } = renderPanel();

    await user.click(
      screen.getByRole("button", { name: "Compare Wendell Carter Jr. head-to-head" }),
    );

    expect(onCompare).toHaveBeenCalledWith({ fa: 10 });
  });

  it("switches scope with two keycap buttons", async () => {
    const user = userEvent.setup();
    const { onScope } = renderPanel();

    const group = screen.getByRole("group", { name: "Show" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "My team and free agents",
      "Free agents only",
    ]);
    buttons.map((button) => expect(button).toHaveClass("keycap"));
    expect(within(group).getByRole("button", { name: "My team and free agents" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "Free agents only" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(within(group).getByRole("button", { name: "Free agents only" }));

    expect(onScope).toHaveBeenCalledWith({ scope: "fa" });
  });

  it("reports the hidden counts on Show all", async () => {
    const user = userEvent.setup();
    const { onShowAll } = renderPanel();

    const toggle = screen.getByRole("button", { name: "Show all (3 above, 7 below)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(onShowAll).toHaveBeenCalledWith({ showAll: true });
  });

  it("keeps the toggle as Show fewer once expanded", async () => {
    const user = userEvent.setup();
    const { onShowAll } = renderPanel({
      line: { entries, hiddenAbove: 0, hiddenBelow: 0 },
      showAll: true,
    });

    const toggle = screen.getByRole("button", { name: "Show fewer" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);

    expect(onShowAll).toHaveBeenCalledWith({ showAll: false });
  });

  it("counts only the side that hides rows", () => {
    renderPanel({ line: { entries, hiddenAbove: 0, hiddenBelow: 4 } });

    expect(screen.getByRole("button", { name: "Show all (4 below)" })).toBeInTheDocument();
  });

  it("leaves out Show all when nothing is hidden", () => {
    renderPanel({ line: { entries, hiddenAbove: 0, hiddenBelow: 0 } });

    expect(screen.queryByRole("button", { name: /^Show all/ })).not.toBeInTheDocument();
  });

  it("says so when the filter leaves no free agents", () => {
    renderPanel({
      line: { entries: [{ kind: "line" }], hiddenAbove: 0, hiddenBelow: 0 },
      scope: "fa",
    });

    expect(screen.getByText("No free agents match this range and position.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps your players on the table when no free agent is left", () => {
    renderPanel({
      line: {
        entries: [makeEntry({ playerId: 1, fullName: "Paul Reed" }), { kind: "line" }],
        hiddenAbove: 0,
        hiddenBelow: 0,
      },
    });

    expect(screen.getByText("No free agents match this range and position.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paul Reed" })).toBeInTheDocument();
  });
});

describe("CutLinePanel sorting", () => {
  const names = (): string[] =>
    screen
      .getAllByRole("row")
      .slice(1)
      .flatMap((row) => within(row).queryAllByRole("link").slice(0, 1))
      .map((link) => link.textContent ?? "");

  type HeaderProps = { name: string };

  const header = ({ name }: HeaderProps): HTMLElement =>
    screen.getByRole("columnheader", { name: new RegExp(`^${name}`) });

  it("opens windowed around the line, with the line drawn", () => {
    renderPanel();
    expect(names()).not.toContain("Hidden Star");
    expect(screen.getByText("Cut line: your worst player")).toBeInTheDocument();
  });

  it("sorts every row of the scope, the hidden ones too", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(header({ name: "Value" })).getByRole("button"));

    expect(names()).toEqual([
      "Hidden Star",
      "Isaiah Hartenstein",
      "Wendell Carter Jr.",
      "Daniel Gafford",
      "Paul Reed",
      "Yves Missi",
    ]);
  });

  it("drops the cut line and the window while sorted, since the order no longer means a line", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(header({ name: "Value" })).getByRole("button"));

    expect(screen.queryByText("Cut line: your worst player")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });

  it("flips on a second click and returns to the window on a third", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(header({ name: "Value" })).getByRole("button"));
    await user.click(within(header({ name: "Value" })).getByRole("button"));
    expect(names().at(0)).toBe("Yves Missi");
    expect(header({ name: "Value" })).toHaveAttribute("aria-sort", "ascending");

    await user.click(within(header({ name: "Value" })).getByRole("button"));
    expect(screen.getByText("Cut line: your worst player")).toBeInTheDocument();
    expect(names()).not.toContain("Hidden Star");
    expect(screen.getByRole("button", { name: /Show all/ })).toBeInTheDocument();
  });

  it("sorts by owner and by name alphabetically", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(header({ name: "Player" })).getByRole("button"));
    expect(names().at(0)).toBe("Daniel Gafford");

    await user.click(within(header({ name: "Owner" })).getByRole("button"));
    expect(screen.getByRole("columnheader", { name: /^Owner/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(names().slice(0, 3).sort()).toEqual(["Hidden Star", "Wendell Carter Jr.", "Yves Missi"]);
  });

  it("sorts the rank column from the top down first", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(header({ name: "Rank" })).getByRole("button"));

    expect(names().at(0)).toBe("Hidden Star");
  });

  it("windows a long sorted list and shows more on request", async () => {
    const user = userEvent.setup();
    const many: CutLine = {
      entries: Array.from({ length: 60 }, (_, index) =>
        makeEntry({ playerId: index + 1, value: index, owner: "free_agent" }),
      ),
      hiddenAbove: 0,
      hiddenBelow: 0,
    };
    renderPanel({ full: many });

    await user.click(within(header({ name: "Value" })).getByRole("button"));
    expect(names()).toHaveLength(25);
    await user.click(screen.getByRole("button", { name: "Show 25 more (35 left)" }));
    expect(names()).toHaveLength(50);
    await user.click(screen.getByRole("button", { name: "Show 10 more (10 left)" }));
    expect(names()).toHaveLength(60);
    expect(screen.queryByRole("button", { name: /more/ })).not.toBeInTheDocument();
  });

  it("right-aligns the rank and value headers over their numbers", () => {
    renderPanel();
    expect(header({ name: "Rank" })).toHaveClass("numeric");
    expect(header({ name: "Value" })).toHaveClass("numeric");
    expect(header({ name: "Player" })).not.toHaveClass("numeric");
  });
});
