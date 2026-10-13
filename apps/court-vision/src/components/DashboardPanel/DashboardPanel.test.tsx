import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { DashboardPanel, DashboardPanelEmpty } from "@/components/DashboardPanel/DashboardPanel";

afterEach(cleanup);

describe("DashboardPanel", () => {
  it("names its section after its h2 title", () => {
    render(
      <DashboardPanel id="home-team-title" title="Your Team">
        <p>roster</p>
      </DashboardPanel>,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Your Team" });
    expect(heading).toHaveAttribute("id", "home-team-title");
    expect(screen.getByRole("region", { name: "Your Team" })).toHaveClass("panel");
    expect(screen.getByText("roster")).toBeInTheDocument();
  });

  it("adds the page's layout class beside its own", () => {
    render(
      <DashboardPanel id="t" title="T" className="panelCardLeft">
        <DashboardPanelEmpty>Nothing yet.</DashboardPanelEmpty>
      </DashboardPanel>,
    );

    const panel = screen.getByRole("region", { name: "T" });
    expect(panel).toHaveClass("panel");
    expect(panel).toHaveClass("panelCardLeft");
    expect(screen.getByText("Nothing yet.")).toHaveClass("empty");
  });
});
