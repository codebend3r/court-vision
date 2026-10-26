import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { SeriesChips } from "@/components/SeriesChart/SeriesChips";
import { type SeriesSelection } from "@/components/SeriesChart/useSeriesSelection";

afterEach(cleanup);

type Key = "pts" | "min";

type SelectionOfProps = { active: readonly Key[] };

const selectionOf = ({ active }: SelectionOfProps) => {
  const toggle = vi.fn<SeriesSelection<Key>["toggle"]>();
  const toggleAll = vi.fn<SeriesSelection<Key>["toggleAll"]>();
  const selection: SeriesSelection<Key> = {
    active,
    isActive: ({ key }) => active.includes(key),
    hasActive: active.length > 0,
    toggle,
    toggleAll,
  };
  return { selection, toggle, toggleAll };
};

const CHIPS = [
  { key: "pts", label: "PTS", title: "Points", mark: <span aria-hidden="true">•</span> },
  { key: "min", label: "MIN", disabled: true, mark: <span aria-hidden="true">•</span> },
] as const;

describe("SeriesChips", () => {
  it("presses the active chips and never a disabled one", () => {
    const { selection } = selectionOf({ active: ["pts", "min"] });
    render(<SeriesChips chips={CHIPS} selection={selection} all={["pts", "min"]} />);

    expect(screen.getByRole("button", { name: "PTS" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "PTS" })).toHaveAttribute("title", "Points");
    const minChip = screen.getByRole("button", { name: "MIN" });
    expect(minChip).toBeDisabled();
    expect(minChip).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles the clicked series", async () => {
    const user = userEvent.setup();
    const { selection, toggle } = selectionOf({ active: [] });
    render(<SeriesChips chips={CHIPS} selection={selection} all={["pts", "min"]} />);

    await user.click(screen.getByRole("button", { name: "PTS" }));

    expect(toggle).toHaveBeenCalledWith({ key: "pts" });
  });

  it("offers Clear all while anything is on and hands it the full list", async () => {
    const user = userEvent.setup();
    const { selection, toggleAll } = selectionOf({ active: ["pts"] });
    render(<SeriesChips chips={CHIPS} selection={selection} all={["pts"]} />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(toggleAll).toHaveBeenCalledWith({ all: ["pts"] });
  });

  it("offers Select all once everything is off", () => {
    const { selection } = selectionOf({ active: [] });
    render(<SeriesChips chips={CHIPS} selection={selection} all={["pts", "min"]} />);

    expect(screen.getByRole("button", { name: "Select all" })).toBeInTheDocument();
  });
});
