import { act, cleanup, render, screen, within } from "@testing-library/react";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

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

const clickAndFlush = ({ name }: { name: string }) => {
  vi.useFakeTimers();
  try {
    act(() => {
      screen.getByRole("button", { name }).click();
      vi.runAllTimers();
    });
  } finally {
    vi.useRealTimers();
  }
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

  it("writes the selected mode to the URL", () => {
    const { onUrlUpdate } = renderFilters();

    clickAndFlush({ name: "Totals" });

    // The testing adapter has no memory, so the URL never catches up to the
    // write and the re-apply effect can land a redundant second write that is
    // impossible against a real URL. Assert every write agrees on the pick
    // rather than an exact call count, which is a race under that adapter.
    expect(onUrlUpdate).toHaveBeenCalled();
    onUrlUpdate.mock.calls.map(([event]) => expect(event.searchParams.get("mode")).toBe("totals"));
  });

  it("writes the selected span to the URL and keeps the current mode", () => {
    const { onUrlUpdate } = renderFilters({ searchParams: "?mode=per36" });

    clickAndFlush({ name: "L10" });

    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    const updated = onUrlUpdate.mock.calls[0][0].searchParams;
    expect(updated.get("span")).toBe("10");
    expect(updated.get("mode")).toBe("per36");
  });

  it("clears the param when selecting the default again", () => {
    const { onUrlUpdate } = renderFilters({ searchParams: "?mode=totals" });

    clickAndFlush({ name: "Game" });

    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("mode")).toBeNull();
  });

  it("re-applies the remembered mode when a bare URL renders after a pick", () => {
    renderFilters();
    clickAndFlush({ name: "Per 36" });
    cleanup();

    vi.useFakeTimers();
    const { onUrlUpdate } = renderFilters();
    act(() => vi.runAllTimers());
    vi.useRealTimers();

    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("mode")).toBe("per36");
  });

  it("lets an explicit ?mode= in the URL win over the remembered preference", () => {
    useStatModeStore.getState().setMode({ mode: "per36" });

    const { onUrlUpdate } = renderFilters({ searchParams: "?mode=totals" });

    expect(screen.getByRole("button", { name: "Totals" })).toHaveAttribute("aria-pressed", "true");
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});
