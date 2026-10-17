import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { CutLinePanel } from "@/components/WaiverWireView/CutLinePanel";
import { type CutLine, type CutLineEntry, type CutScope } from "@/lib/waiverWire/cutLine";
import { type WaiverRosterEntry, type WaiverRow } from "@/lib/waiverWire/types";

afterEach(cleanup);

const makeEntry = ({
  isUpgrade = false,
  ...overrides
}: Partial<WaiverRow> & { playerId: number; isUpgrade?: boolean }): CutLineEntry => ({
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

const renderPanel = ({
  line = cutLine,
  scope = "all",
  showAll = false,
  noStats = [],
}: {
  line?: CutLine;
  scope?: CutScope;
  showAll?: boolean;
  noStats?: WaiverRosterEntry[];
} = {}) => {
  const onScope = vi.fn<({ scope }: { scope: CutScope }) => void>();
  const onShowAll = vi.fn<({ showAll }: { showAll: boolean }) => void>();
  const onCompare = vi.fn<({ fa }: { fa: number }) => void>();
  render(
    <CutLinePanel
      cutLine={line}
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

const rowOf = ({ name }: { name: string }): HTMLElement => {
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
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Rank",
      "Player",
      "Owner",
      "Value",
    ]);
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

  it("opens head-to-head from a free agent's name", async () => {
    const user = userEvent.setup();
    const { onCompare } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Wendell Carter Jr." }));

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
