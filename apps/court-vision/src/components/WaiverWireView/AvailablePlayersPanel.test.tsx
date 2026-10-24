import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { AvailablePlayersPanel } from "@/components/WaiverWireView/AvailablePlayersPanel";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type FantasyStatLine } from "@/lib/valuation/types";
import { type WaiverRow } from "@/lib/waiverWire/types";

afterEach(cleanup);

const row = ({ playerId, rank }: { playerId: number; rank: number }): WaiverRow => ({
  playerId,
  fullName: `Player ${playerId}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  value: 3 - rank / 100,
  rank,
  owner: "free_agent",
  injuryStatus: null,
});

const pool = (count: number): WaiverRow[] =>
  Array.from({ length: count }, (_, index) => row({ playerId: index + 1, rank: index + 1 }));

const linesFor = ({ count }: { count: number }): Map<number, FantasyStatLine> =>
  new Map(
    Array.from({ length: count }, (_, index) => [
      index + 1,
      makeStatLine({ playerId: index + 1, gamesPlayed: 10, pts: 150 }),
    ]),
  );

const renderPanel = ({
  count = 3,
  onCompare = vi.fn(),
}: { count?: number; onCompare?: ({ fa }: { fa: number }) => void } = {}) =>
  render(
    <AvailablePlayersPanel
      freePool={pool(count)}
      linesById={linesFor({ count })}
      onCompare={onCompare}
      compareHintId="hint"
    />,
  );

// A sortable header carries its arrow glyph in the markup, shown only once the
// column is the sorted one; the header's name is the text without it.
const headerName = (header: HTMLElement): string => (header.textContent ?? "").replace(/[▲▼]/g, "");

const bodyRows = (): HTMLElement[] => screen.getAllByRole("row").slice(1);

describe("AvailablePlayersPanel", () => {
  it("lists every available player with rank, stats and value", () => {
    renderPanel();
    expect(screen.getByText("3 available players")).toBeInTheDocument();
    const [first] = bodyRows();
    if (first === undefined) throw new Error("no rows");
    expect(within(first).getByText("Player 1")).toBeInTheDocument();
    expect(within(first).getAllByText("15.0").length).toBeGreaterThan(0);
    expect(within(first).getByText("2.99")).toBeInTheDocument();
  });

  it("names the table's columns, the nine categories among them", () => {
    renderPanel();
    expect(screen.getAllByRole("columnheader").map(headerName)).toEqual([
      "Rank",
      "Player",
      "GP",
      "PTS",
      "REB",
      "AST",
      "STL",
      "BLK",
      "3PM",
      "FG%",
      "FT%",
      "TOV",
      "Value",
    ]);
  });

  it("opens a player head-to-head from their name", async () => {
    const user = userEvent.setup();
    const onCompare = vi.fn();
    renderPanel({ onCompare });
    await user.click(screen.getByRole("button", { name: "Compare Player 2 head-to-head" }));
    expect(onCompare).toHaveBeenCalledWith({ fa: 2 });
  });

  it("windows a long list and shows more on request", async () => {
    const user = userEvent.setup();
    renderPanel({ count: 60 });
    expect(bodyRows()).toHaveLength(25);
    await user.click(screen.getByRole("button", { name: "Show 25 more (35 left)" }));
    expect(bodyRows()).toHaveLength(50);
    await user.click(screen.getByRole("button", { name: "Show 10 more (10 left)" }));
    expect(bodyRows()).toHaveLength(60);
    expect(screen.queryByRole("button", { name: /more/ })).not.toBeInTheDocument();
  });

  it("searches the whole pool, not just the rows on screen", async () => {
    const user = userEvent.setup();
    renderPanel({ count: 60 });
    await user.type(
      screen.getByRole("searchbox", { name: "Search available players" }),
      "Player 58",
    );
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("1 available player of 60")).toBeInTheDocument();
  });

  it("says when nobody matches the search", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText('No available player matches "zzz".')).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says so when the pool is empty", () => {
    renderPanel({ count: 0 });
    expect(
      screen.getByText("No available players match this range and position."),
    ).toBeInTheDocument();
  });
});

describe("AvailablePlayersPanel sorting", () => {
  // Player 2 scores most, then 1, then 3; rank is 1, 2, 3 in that id order.
  const sortPool = pool(3);
  const sortLines = new Map(
    [
      [1, 150],
      [2, 300],
      [3, 50],
    ].map(([playerId, pts]) => [
      playerId ?? 0,
      makeStatLine({ playerId: playerId ?? 0, gamesPlayed: 10, pts }),
    ]),
  );

  const renderSortable = () =>
    render(
      <AvailablePlayersPanel
        freePool={sortPool}
        linesById={sortLines}
        onCompare={vi.fn()}
        compareHintId="hint"
      />,
    );

  const order = (): string[] =>
    bodyRows().map((row) => within(row).getAllByRole("link")[0]?.textContent ?? "");

  const header = ({ name }: { name: string }): HTMLElement =>
    screen.getByRole("columnheader", { name: new RegExp(`^${name}`) });

  it("lists in rank order until a header is clicked", () => {
    renderSortable();
    expect(order()).toEqual(["Player 1", "Player 2", "Player 3"]);
    expect(screen.queryByRole("columnheader", { selected: true })).not.toBeInTheDocument();
  });

  it("sorts a stat from its highest first, then lowest first, then back to rank order", async () => {
    const user = userEvent.setup();
    renderSortable();

    await user.click(within(header({ name: "PTS" })).getByRole("button"));
    expect(order()).toEqual(["Player 2", "Player 1", "Player 3"]);
    expect(header({ name: "PTS" })).toHaveAttribute("aria-sort", "descending");

    await user.click(within(header({ name: "PTS" })).getByRole("button"));
    expect(order()).toEqual(["Player 3", "Player 1", "Player 2"]);
    expect(header({ name: "PTS" })).toHaveAttribute("aria-sort", "ascending");

    await user.click(within(header({ name: "PTS" })).getByRole("button"));
    expect(order()).toEqual(["Player 1", "Player 2", "Player 3"]);
    expect(header({ name: "PTS" })).not.toHaveAttribute("aria-sort");
  });

  it("sorts by name, alphabetically first", async () => {
    const user = userEvent.setup();
    renderSortable();

    await user.click(within(header({ name: "Player" })).getByRole("button"));
    expect(order()).toEqual(["Player 1", "Player 2", "Player 3"]);
    await user.click(within(header({ name: "Player" })).getByRole("button"));
    expect(order()).toEqual(["Player 3", "Player 2", "Player 1"]);
  });

  it("sorts the rank column from the top down first", async () => {
    const user = userEvent.setup();
    renderSortable();

    await user.click(within(header({ name: "Rank" })).getByRole("button"));
    expect(header({ name: "Rank" })).toHaveAttribute("aria-sort", "ascending");
    await user.click(within(header({ name: "Rank" })).getByRole("button"));
    expect(order()).toEqual(["Player 3", "Player 2", "Player 1"]);
  });

  it("sorts the whole pool, not just the rows on screen", async () => {
    const user = userEvent.setup();
    const many = pool(60);
    const lines = new Map(
      many.map((entry) => [
        entry.playerId,
        makeStatLine({ playerId: entry.playerId, gamesPlayed: 10, pts: entry.playerId * 10 }),
      ]),
    );
    render(
      <AvailablePlayersPanel
        freePool={many}
        linesById={lines}
        onCompare={vi.fn()}
        compareHintId="hint"
      />,
    );

    await user.click(within(header({ name: "PTS" })).getByRole("button"));

    expect(bodyRows()).toHaveLength(25);
    expect(order()[0]).toBe("Player 60");
  });

  it("keeps the search while sorted", async () => {
    const user = userEvent.setup();
    renderSortable();

    await user.type(screen.getByRole("searchbox"), "Player");
    await user.click(within(header({ name: "PTS" })).getByRole("button"));
    await user.type(screen.getByRole("searchbox"), " 3");

    expect(order()).toEqual(["Player 3"]);
  });

  it("right-aligns every numeric header over its numbers", () => {
    renderSortable();
    ["Rank", "GP", "PTS", "REB", "AST", "STL", "BLK", "3PM", "FG%", "FT%", "TOV", "Value"].map(
      (name) => expect(header({ name })).toHaveClass("numeric"),
    );
    expect(header({ name: "Player" })).not.toHaveClass("numeric");
  });

  it("links every name to the player's page and keeps Compare apart from it", async () => {
    const user = userEvent.setup();
    const onCompare = vi.fn();
    render(
      <AvailablePlayersPanel
        freePool={sortPool}
        linesById={sortLines}
        onCompare={onCompare}
        compareHintId="hint"
      />,
    );

    expect(screen.getByRole("link", { name: "Player 2" })).toHaveAttribute("href", "/players/2");
    await user.click(screen.getByRole("link", { name: "Player 2" }));
    expect(onCompare).not.toHaveBeenCalled();
  });
});
