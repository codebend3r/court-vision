import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ROSTER_PAGE_HEADER } from "@/app/roster/header";
import Loading from "@/app/roster/loading";

afterEach(cleanup);

describe("roster loading boundary", () => {
  it("keeps the real page heading while the roster loads", () => {
    render(<Loading />);
    expect(
      screen.getByRole("heading", { level: 1, name: ROSTER_PAGE_HEADER.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your roster");
  });
});
