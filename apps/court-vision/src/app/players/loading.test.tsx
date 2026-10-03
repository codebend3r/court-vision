import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { PLAYERS_PAGE_HEADER } from "@/app/players/header";
import Loading from "@/app/players/loading";

afterEach(cleanup);

describe("players loading boundary", () => {
  // Asserted against the shared constant rather than a literal, so the test
  // still means "the skeleton shows the page's own heading" after a copy edit.
  it("keeps the real page heading while the table loads", () => {
    render(<Loading />);
    expect(
      screen.getByRole("heading", { level: 1, name: PLAYERS_PAGE_HEADER.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading players");
  });
});
