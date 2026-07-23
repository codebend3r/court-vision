import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlayersTabs } from "@/components/PlayersTabs/PlayersTabs";

afterEach(cleanup);

describe("PlayersTabs", () => {
  it("renders three tab links with tab-scoped hrefs", () => {
    render(<PlayersTabs active="regular" q="" size={50} range="all" />);

    expect(screen.getByRole("link", { name: /Regular Stats/ })).toHaveAttribute("href", "/players");
    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "href",
      "/players?tab=advanced",
    );
    expect(screen.getByRole("link", { name: /Fantasy Value/ })).toHaveAttribute(
      "href",
      "/players?tab=fantasy",
    );
  });

  it("marks the active tab with aria-current", () => {
    render(<PlayersTabs active="advanced" q="" size={50} range="all" />);

    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Regular Stats/ })).not.toHaveAttribute("aria-current");
  });

  it("preserves the search query and game range across tabs", () => {
    render(<PlayersTabs active="regular" q="curry" size={25} range="last20" />);

    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "href",
      "/players?q=curry&size=25&tab=advanced&range=last20",
    );
  });

  it("no longer shows a Soon badge on the Fantasy Value tab", () => {
    render(<PlayersTabs active="regular" q="" size={50} range="all" />);

    expect(screen.queryByText("Soon")).not.toBeInTheDocument();
  });
});
