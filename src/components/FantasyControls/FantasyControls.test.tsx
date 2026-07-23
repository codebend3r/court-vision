import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FantasyControls,
  type FantasyControlsProps,
} from "@/components/FantasyControls/FantasyControls";

afterEach(cleanup);

const renderControls = (overrides: Partial<FantasyControlsProps> = {}) => {
  const onChange = vi.fn();
  const props: FantasyControlsProps = {
    q: "",
    range: "all",
    mode: "average",
    excluded: [],
    weights: {},
    teams: 12,
    slots: 13,
    onChange,
    ...overrides,
  };
  render(<FantasyControls {...props} />);
  return { onChange };
};

describe("FantasyControls", () => {
  it("emits a debounced trimmed search query", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls();
    await user.type(screen.getByLabelText("Search players"), "  lebron ");
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ q: "lebron", page: 1 }));
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
    await user.click(screen.getByRole("button", { name: "Reset" }));
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

  it("explains what weights and league settings apply to", () => {
    renderControls();
    expect(screen.getByText(/Points uses points-league scoring instead/)).toBeInTheDocument();
    expect(screen.getByText(/VORP replacement rank/)).toBeInTheDocument();
  });
});
