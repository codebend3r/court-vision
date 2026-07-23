import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import MyTeamsPage from "@/app/my-teams/page";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";

beforeEach(() => {
  useFantasyTeamsStore.setState({ teams: [] });
});

afterEach(cleanup);

describe("MyTeamsPage", () => {
  it("renders the heading, create button, and team list", () => {
    render(<MyTeamsPage />);
    expect(screen.getByRole("heading", { name: "My Teams" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
  });
});
