import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import HomePage from "@/app/page";

afterEach(cleanup);

// SportShellHome's own tests cover the page; this pins the wiring.
describe("Diamond Vision home page", () => {
  it("renders Diamond Vision's copy over the baseball descriptor", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Diamond Vision" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Scoring categories: Pitchers" }),
    ).toBeInTheDocument();
  });
});
