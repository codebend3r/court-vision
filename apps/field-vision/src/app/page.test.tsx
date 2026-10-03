import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import HomePage from "@/app/page";

afterEach(cleanup);

describe("Field Vision home page", () => {
  it("titles the page with the app's name", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Field Vision" })).toBeInTheDocument();
  });

  it("says the data is still to come", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Player data" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("describes the scoring and roster from the sport descriptor", () => {
    render(<HomePage />);
    expect(screen.getByRole("region", { name: "Points scoring" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Roster slots" })).toBeInTheDocument();
  });
});
