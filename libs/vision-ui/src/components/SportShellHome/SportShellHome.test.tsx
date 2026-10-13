import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { basketballFixture } from "@vision/core/testing/basketballDescriptor";

import { SportShellHome } from "#ui/components/SportShellHome/SportShellHome";

afterEach(cleanup);

const renderHome = () =>
  render(
    <SportShellHome
      sport={basketballFixture}
      name="Court Vision"
      eyebrow="Fantasy basketball"
      league="NBA"
      description="Fantasy basketball analytics."
    />,
  );

describe("SportShellHome", () => {
  it("titles the page with the app's name under its eyebrow and description", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Court Vision" })).toBeInTheDocument();
    expect(screen.getByText("Fantasy basketball")).toBeInTheDocument();
    expect(screen.getByText("Fantasy basketball analytics.")).toBeInTheDocument();
  });

  it("says the league's data is still to come", () => {
    renderHome();
    expect(screen.getByRole("heading", { name: "Player data" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByText(/^NBA stats aren't connected yet\./)).toBeInTheDocument();
  });

  it("describes the scoring and roster from the sport descriptor", () => {
    renderHome();
    expect(screen.getByRole("region", { name: "Points scoring" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Roster slots" })).toBeInTheDocument();
  });
});
