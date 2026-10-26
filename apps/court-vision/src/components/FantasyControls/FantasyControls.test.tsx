import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import {
  FantasyControls,
  type FantasyControlsProps,
} from "@/components/FantasyControls/FantasyControls";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";
import { DEFAULT_POINTS_SCORING } from "@vision/sport-basketball/engine";

afterEach(cleanup);

const renderControls = (overrides: Partial<FantasyControlsProps> = {}) => {
  const onChange = vi.fn();
  const props: FantasyControlsProps = {
    q: "",
    range: "all",
    mode: "average",
    owner: "all",
    excluded: [],
    weights: {},
    sort: "z",
    scoring: DEFAULT_POINTS_SCORING,
    teams: 12,
    slots: 13,
    onChange,
    ...overrides,
  };
  render(<FantasyControls {...props} />);
  return { onChange };
};

describe("FantasyControls roster-status filter", () => {
  afterEach(() => act(() => useRosteredStore.setState({ owners: null })));

  it("offers the three quick filters and emits the choice, back to page one", async () => {
    useRosteredStore.getState().hydrate({ playerIds: [], owners: [] });
    const user = userEvent.setup();
    const { onChange } = renderControls({ owner: "all" });

    const group = screen.getByRole("group", { name: "Roster status" });
    expect(within(group).getByRole("button", { name: "All players" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(group).getByRole("button", { name: "Free agents" }));

    expect(onChange).toHaveBeenCalledWith({ owner: "free", page: 1 });
  });

  it("hides the filter while the league's rosters are unknown", () => {
    renderControls();

    expect(screen.queryByRole("group", { name: "Roster status" })).toBeNull();
  });
});

describe("FantasyControls", () => {
  it("emits a debounced trimmed search query", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();
    await user.type(screen.getByLabelText("Search players"), "  lebron ");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ q: "lebron", page: 1 }));
  });

  it("emits range and mode changes", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();
    await user.selectOptions(screen.getByLabelText("Game range"), "last10");
    expect(onChange).toHaveBeenCalledWith({ range: "last10", page: 1 });
    await user.selectOptions(screen.getByLabelText("Stat display"), "total");
    expect(onChange).toHaveBeenCalledWith({ mode: "total", page: 1 });
  });

  it("toggles a punt from the category chip", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();
    await user.click(screen.getByRole("button", { name: "Punt PTS" }));
    expect(onChange).toHaveBeenCalledWith({ w: { pts: 0 } });
  });

  it("restores a punted category on second click", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({ weights: { pts: 0, ft: 0.5 } });
    await user.click(screen.getByRole("button", { name: "Punt PTS" }));
    expect(onChange).toHaveBeenCalledWith({ w: { ft: 0.5 } });
  });

  it("excludes a category and clears its weight", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({ weights: { pts: 0 } });
    await user.click(screen.getByRole("button", { name: "Exclude PTS" }));
    expect(onChange).toHaveBeenCalledWith({ x: ["pts"], w: {} });
  });

  it("re-includes an excluded category from its ghost chip", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({ excluded: ["pts"] });
    await user.click(screen.getByRole("button", { name: "Include PTS" }));
    expect(onChange).toHaveBeenCalledWith({ x: [] });
  });

  it("snaps weight stepper input and drops the default weight", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();
    const stepper = screen.getByRole("spinbutton", { name: "FT%" });
    await user.clear(stepper);
    await user.type(stepper, "0.5");
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ w: { ft: 0.5 } });
  });

  it("resets weights and exclusions together", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({ weights: { ft: 0 }, excluded: ["tov"] });
    // Weights and Scoring each own a Reset; this is the weights one.
    await user.click(screen.getAllByRole("button", { name: "Reset" })[0]);
    expect(onChange).toHaveBeenCalledWith({ w: {}, x: [] });
  });

  it("clamps league inputs", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();
    const teams = screen.getByRole("spinbutton", { name: "Teams" });
    await user.clear(teams);
    await user.type(teams, "99");
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ teams: 30 });
  });

  it("falls back to the standard league when a league box is cleared", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({ teams: 8, slots: 10 });
    await user.clear(screen.getByRole("spinbutton", { name: "Teams" }));
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ teams: 12 });
    await user.clear(screen.getByRole("spinbutton", { name: "Roster slots" }));
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ slots: 13 });
  });

  it("restores a stat's default score when its scoring box is cleared", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();
    const scoringSection = [...document.querySelectorAll("details")].find((element) =>
      (element.querySelector("summary")?.textContent ?? "").includes("Scoring"),
    );
    if (!(scoringSection instanceof HTMLElement)) throw new Error("scoring section not found");
    const reb = within(scoringSection).getByRole("spinbutton", { name: "REB" });
    await user.clear(reb);
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ s: DEFAULT_POINTS_SCORING });
  });

  it("explains what weights and league settings apply to", () => {
    renderControls();
    expect(screen.getByText(/Applies to the Z-Score column only/)).toBeInTheDocument();
    expect(screen.getByText(/VORP replacement rank/)).toBeInTheDocument();
  });
});

// The Scoring panel reuses stat labels (PTS, AST…), so weight steppers must be
// queried inside the Weights disclosure specifically.
const weightsSection = (): HTMLElement => {
  const details = [...document.querySelectorAll("details")].find((element) =>
    (element.querySelector("summary")?.textContent ?? "").includes("Weights"),
  );
  if (!(details instanceof HTMLElement)) throw new Error("weights section not found");
  return details;
};

describe("FantasyControls per-column weights", () => {
  it("names the column the weights apply to", () => {
    renderControls({ sort: "g" });
    expect(screen.getByText("Weights — G-Score")).toBeInTheDocument();
    expect(screen.getByText(/Applies to the G-Score column only/)).toBeInTheDocument();
  });

  it("disables the weight steppers on PL Linear, which never reads them", () => {
    renderControls({ sort: "points" });
    expect(screen.getByText(/PL Linear ignores weights/)).toBeInTheDocument();
    within(weightsSection())
      .getAllByRole("spinbutton")
      .forEach((stepper) => expect(stepper).toBeDisabled());
  });

  it("disables the weight steppers on name sorts", () => {
    renderControls({ sort: "lastName" });
    expect(screen.getByText(/Sort by a method column to tune its weights/)).toBeInTheDocument();
  });

  it("keeps the steppers live on a weighted column", () => {
    renderControls({ sort: "sgp", weights: { ast: 2 } });
    const ast = within(weightsSection()).getByRole("spinbutton", { name: "AST" });
    expect(ast).not.toBeDisabled();
    expect(ast).toHaveValue(2);
  });
});
