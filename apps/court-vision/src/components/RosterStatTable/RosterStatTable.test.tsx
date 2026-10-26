import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "bun:test";

import { RosterStatTable } from "@/components/RosterStatTable/RosterStatTable";
import { type RosterTableColumn, type RosterTableRow } from "@/lib/roster/table";

afterEach(cleanup);

type RowProps = {
  id: number;
  name: string;
  slot: string;
  pts: number | null;
  reb: number;
};

const row = ({ id, name, slot, pts, reb }: RowProps): RosterTableRow => ({
  id,
  slotLabel: slot,
  fullName: `A ${name}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  cells: [
    { text: pts === null ? "—" : pts.toFixed(1), value: pts },
    { text: reb.toFixed(1), value: reb },
  ],
});

const columns: RosterTableColumn[] = [
  { key: "pts", label: "PTS", title: "Points" },
  { key: "reb", label: "REB", title: undefined },
];

const rows = [
  row({ id: 1, name: "Brunson", slot: "PG", pts: 28.5, reb: 3 }),
  row({ id: 2, name: "Hart", slot: "IL", pts: 12, reb: 9 }),
  row({ id: 3, name: "Anunoby", slot: "SF", pts: null, reb: 5 }),
];

const renderTable = () =>
  render(<RosterStatTable label="Regular stats" rows={rows} columns={columns} />);

const playerOrder = (): string[] =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((entry) => within(entry).getAllByRole("link")[0]?.textContent ?? "");

describe("RosterStatTable", () => {
  it("names the table", () => {
    renderTable();
    expect(screen.getByRole("table", { name: "Regular stats" })).toBeInTheDocument();
  });

  it("heads the slot, the player, and each stat", () => {
    renderTable();
    // The arrow glyph is always in the markup, hidden until a column is sorted.
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent?.replace(/[▲▼]/g, "")),
    ).toEqual(["Slot", "Player", "PTS", "REB"]);
  });

  it("lists the players in slot order until a header is clicked", () => {
    renderTable();
    expect(playerOrder()).toEqual(["A Brunson", "A Hart", "A Anunoby"]);
  });

  it("lists each player's slot, stats and a link to their page", () => {
    renderTable();
    const [, first] = screen.getAllByRole("row");
    if (first === undefined) throw new Error("rows missing");
    expect(within(first).getByText("PG")).toBeInTheDocument();
    expect(within(first).getByText("28.5")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "A Brunson" })).toHaveAttribute(
      "href",
      "/players/1",
    );
  });

  it("gives a header its full name as a tooltip", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: /PTS/ })).toHaveAttribute("title", "Points");
  });

  describe("sorting", () => {
    it("sorts a stat from its highest first, then lowest first, then back to slot order", async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(screen.getByRole("button", { name: /REB/ }));
      expect(playerOrder()).toEqual(["A Hart", "A Anunoby", "A Brunson"]);
      expect(screen.getByRole("columnheader", { name: /REB/ })).toHaveAttribute(
        "aria-sort",
        "descending",
      );

      await user.click(screen.getByRole("button", { name: /REB/ }));
      expect(playerOrder()).toEqual(["A Brunson", "A Anunoby", "A Hart"]);
      expect(screen.getByRole("columnheader", { name: /REB/ })).toHaveAttribute(
        "aria-sort",
        "ascending",
      );

      await user.click(screen.getByRole("button", { name: /REB/ }));
      expect(playerOrder()).toEqual(["A Brunson", "A Hart", "A Anunoby"]);
      expect(screen.getByRole("columnheader", { name: /REB/ })).not.toHaveAttribute("aria-sort");
    });

    it("sinks a player with no value to the bottom either way", async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(screen.getByRole("button", { name: /PTS/ }));
      expect(playerOrder().at(-1)).toBe("A Anunoby");
      await user.click(screen.getByRole("button", { name: /PTS/ }));
      expect(playerOrder().at(-1)).toBe("A Anunoby");
    });

    it("sorts the players by name, alphabetically first", async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(screen.getByRole("button", { name: "Player" }));
      expect(playerOrder()).toEqual(["A Anunoby", "A Brunson", "A Hart"]);
    });

    it("sorts by slot label", async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(screen.getByRole("button", { name: "Slot" }));
      expect(playerOrder()).toEqual(["A Hart", "A Brunson", "A Anunoby"]);
    });

    it("marks one sorted column at a time", async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(screen.getByRole("button", { name: /PTS/ }));
      await user.click(screen.getByRole("button", { name: /REB/ }));
      expect(screen.getByRole("columnheader", { name: /PTS/ })).not.toHaveAttribute("aria-sort");
      expect(screen.getByRole("columnheader", { name: /REB/ })).toHaveAttribute(
        "aria-sort",
        "descending",
      );
    });
  });
});
