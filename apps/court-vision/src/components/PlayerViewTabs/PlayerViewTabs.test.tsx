import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { PlayerViewTabs } from "@/components/PlayerViewTabs/PlayerViewTabs";

// The tabs rebuild each href from the live URL so the season, timeframe, and
// chart state survive a view switch.
let currentSearch = "";
vi.mock("next/navigation", () => ({
  usePathname: () => "/players/132",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

afterEach(cleanup);

const hrefParams = (name: RegExp): URLSearchParams => {
  const href = screen.getByRole("link", { name }).getAttribute("href") ?? "";
  return new URL(href, "http://localhost").searchParams;
};

describe("PlayerViewTabs", () => {
  it("renders the three views as links, the default view with a bare href", () => {
    currentSearch = "";
    render(<PlayerViewTabs active="regular" />);

    expect(screen.getByRole("navigation", { name: "Player stat views" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Regular Stats/ })).toHaveAttribute(
      "href",
      "/players/132",
    );
    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "href",
      "/players/132?view=advanced",
    );
    expect(screen.getByRole("link", { name: /Fantasy Value/ })).toHaveAttribute(
      "href",
      "/players/132?view=fantasy",
    );
  });

  it("marks the active view with aria-current", () => {
    currentSearch = "?view=fantasy";
    render(<PlayerViewTabs active="fantasy" />);

    expect(screen.getByRole("link", { name: /Fantasy Value/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Regular Stats/ })).not.toHaveAttribute("aria-current");
  });

  it("carries the season, timeframe, and chart params across views", () => {
    currentSearch = "?season=2024-25&span=10&mode=totals&view=advanced&stats=pts,reb";
    render(<PlayerViewTabs active="advanced" />);

    const fantasy = hrefParams(/Fantasy Value/);
    expect(fantasy.get("season")).toBe("2024-25");
    expect(fantasy.get("span")).toBe("10");
    expect(fantasy.get("mode")).toBe("totals");
    expect(fantasy.get("stats")).toBe("pts,reb");
    expect(fantasy.get("view")).toBe("fantasy");

    // Switching back to the default view clears the param rather than
    // writing view=regular.
    expect(hrefParams(/Regular Stats/).has("view")).toBe(false);
  });
});
