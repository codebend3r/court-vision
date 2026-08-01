import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type StarredPlayersViewProps } from "@/components/StarredPlayersView/StarredPlayersView";

const viewProps = vi.fn();

// StarredPlayersView is an async server component, which React Testing Library
// cannot render nested inside another component's output. The route's own job
// is parsing search params and framing the page, so the view is stubbed and its
// props asserted directly.
vi.mock("@/components/StarredPlayersView/StarredPlayersView", () => ({
  StarredPlayersView: (props: StarredPlayersViewProps) => {
    viewProps(props);
    return <p>starred view</p>;
  },
}));

import WatchlistPage from "@/app/watchlist/page";

beforeEach(() => {
  viewProps.mockReset();
});

afterEach(cleanup);

describe("WatchlistPage", () => {
  it("renders the heading and the starred view with its counter", async () => {
    render(await WatchlistPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Starred Players" })).toBeInTheDocument();
    expect(screen.getByText("starred view")).toBeInTheDocument();
    expect(viewProps).toHaveBeenCalledWith(expect.objectContaining({ showCounter: true }));
  });

  it("forces the starred tab even when the query says otherwise", async () => {
    render(await WatchlistPage({ searchParams: Promise.resolve({ tab: "advanced" }) }));
    expect(viewProps.mock.calls[0]?.[0]?.params).toMatchObject({
      tab: "starred",
      sort: "starredAt",
      dir: "desc",
    });
  });

  it("honours an explicit stat sort from the query", async () => {
    render(await WatchlistPage({ searchParams: Promise.resolve({ sort: "pts", dir: "asc" }) }));
    expect(viewProps.mock.calls[0]?.[0]?.params).toMatchObject({ sort: "pts", dir: "asc" });
  });

  it("normalizes array search params by taking the first value", async () => {
    render(await WatchlistPage({ searchParams: Promise.resolve({ q: ["brunson", "ignored"] }) }));
    expect(viewProps.mock.calls[0]?.[0]?.params).toMatchObject({ q: "brunson" });
  });
});
