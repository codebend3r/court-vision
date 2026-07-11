import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayerStatFilters } from "./PlayerStatFilters";

afterEach(cleanup);

const renderFilters = ({ searchParams = "" }: { searchParams?: string } = {}) => {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  render(<PlayerStatFilters />, {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate }),
  });
  return { onUrlUpdate };
};

describe("PlayerStatFilters", () => {
  it("renders both segmented groups with all options", () => {
    renderFilters();

    expect(screen.getByRole("group", { name: "Stat mode" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Timeframe" })).toBeInTheDocument();
    ["Avg", "Totals", "Per 36", "L10", "L20", "L30", "Season"].map((label) =>
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument(),
    );
  });

  it("presses the defaults (Avg + Season) when the URL has no params", () => {
    renderFilters();

    expect(screen.getByRole("button", { name: "Avg" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Season" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Totals" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "L10" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects URL state in the pressed options", () => {
    renderFilters({ searchParams: "?mode=per36&span=20" });

    expect(screen.getByRole("button", { name: "Per 36" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "L20" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Avg" })).toHaveAttribute("aria-pressed", "false");
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

    await user.click(screen.getByRole("button", { name: "Avg" }));

    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("mode")).toBeNull();
  });
});
