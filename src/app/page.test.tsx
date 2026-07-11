import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("renders the coming soon message", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Coming soon" })).toBeInTheDocument();
    expect(screen.getByText("Court Vision is under construction.")).toBeInTheDocument();
  });
});
