import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import HomePage from "@/app/page";

afterEach(cleanup);

// SportShellHome's own tests cover the page; this pins the wiring.
describe("Rink Vision home page", () => {
  it("renders Rink Vision's copy over the hockey descriptor", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Rink Vision" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Scoring categories: Goalies" })).toBeInTheDocument();
  });
});
