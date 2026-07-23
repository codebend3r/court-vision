import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type UrlUpdateEvent, withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { useStatModeStore } from "@/lib/stats/modeStore";
import { DEFAULT_MODE } from "@/lib/stats/searchParams";

// The component reads the raw URL through next/navigation to tell an explicit
// ?mode= apart from a bare URL; mirror renderFilters' searchParams here.
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

afterEach(cleanup);

// The preference store is a module-level singleton, so reset it between tests.
beforeEach(() => {
  useStatModeStore.setState({ mode: DEFAULT_MODE });
});

const renderFilters = ({ searchParams = "" }: { searchParams?: string } = {}) => {
  currentSearch = searchParams;
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  render(<PlayerStatFilters />, {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate }),
  });
  return { onUrlUpdate };
};

describe("PlayerStatFilters", () => {
  it("renders both segmented groups with all options, Game first", () => {
    renderFilters();

    expect(screen.getByRole("group", { name: "Stat mode" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Timeframe" })).toBeInTheDocument();
    ["Avg", "Game", "Totals", "Per 36", "L5", "L10", "L20", "L40", "L60", "All"].map((label) =>
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument(),
    );

    const modeGroup = screen.getByRole("group", { name: "Stat mode" });
    const modeLabels = within(modeGroup)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(modeLabels).toEqual(["Game", "Avg", "Totals", "Per 36"]);
  });

  it("presses the defaults (Game + All) when the URL has no params", () => {
    renderFilters();

    expect(screen.getByRole("button", { name: "Game" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Totals" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "L10" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects URL state in the pressed options", () => {
    renderFilters({ searchParams: "?mode=per36&span=20" });

    expect(screen.getByRole("button", { name: "Per 36" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "L20" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Game" })).toHaveAttribute("aria-pressed", "false");
  });

  it("writes the selected mode to the URL", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderFilters();

    await user.click(screen.getByRole("button", { name: "Totals" }));

    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("mode")).toBe("totals");
  });

  it("writes the selected span to the URL and keeps the current mode", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderFilters({ searchParams: "?mode=per36" });

    await user.click(screen.getByRole("button", { name: "L10" }));

    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    const updated = onUrlUpdate.mock.calls[0][0].searchParams;
    expect(updated.get("span")).toBe("10");
    expect(updated.get("mode")).toBe("per36");
  });

  it("clears the param when selecting the default again", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderFilters({ searchParams: "?mode=totals" });

    await user.click(screen.getByRole("button", { name: "Game" }));

    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("mode")).toBeNull();
  });

  it("re-applies the remembered mode when a bare URL renders after a pick", async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByRole("button", { name: "Per 36" }));
    cleanup();

    const { onUrlUpdate } = renderFilters();

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    });
    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("mode")).toBe("per36");
  });

  it("lets an explicit ?mode= in the URL win over the remembered preference", () => {
    useStatModeStore.getState().setMode({ mode: "per36" });

    const { onUrlUpdate } = renderFilters({ searchParams: "?mode=totals" });

    expect(screen.getByRole("button", { name: "Totals" })).toHaveAttribute("aria-pressed", "true");
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});
