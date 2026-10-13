import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import HomePage from "@/app/page";

afterEach(cleanup);

// SportShellHome's own tests cover the page; this pins the wiring.
describe("Field Vision home page", () => {
  it("renders Field Vision's copy over the football descriptor", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Field Vision" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "QB" })).toBeInTheDocument();
  });
});
