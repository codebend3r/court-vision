import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { FantasyTeamLogo } from "@/components/FantasyTeamLogo/FantasyTeamLogo";

const LOGO_URL = "https://s.yimg.com/cv/apiv2/default/nba/nba_4_g.png";

afterEach(cleanup);

describe("FantasyTeamLogo", () => {
  it("renders the logo as a decorative image", () => {
    const { container } = render(<FantasyTeamLogo name="Better Call Gasol" logoUrl={LOGO_URL} />);

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(decodeURIComponent(image?.getAttribute("src") ?? "")).toContain(LOGO_URL);
    expect(screen.queryByText("BC")).not.toBeInTheDocument();
  });

  it("shows the first letters of the first two words when there is no logo", () => {
    const { container } = render(<FantasyTeamLogo name="Better Call Gasol" logoUrl={null} />);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("BC")).toBeInTheDocument();
  });

  it("shows the first two letters of a one-word name", () => {
    render(<FantasyTeamLogo name="Newfoundlanders" logoUrl={null} />);

    expect(screen.getByText("NE")).toBeInTheDocument();
  });

  it("falls back to initials when the logo fails to load", () => {
    const { container } = render(<FantasyTeamLogo name="Better Call Gasol" logoUrl={LOGO_URL} />);

    const image = container.querySelector("img");
    if (image === null) throw new Error("no logo image");
    fireEvent.error(image);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("BC")).toBeInTheDocument();
  });

  it("hides the initials from assistive tech, since the name sits beside them", () => {
    render(<FantasyTeamLogo name="Better Call Gasol" logoUrl={null} />);

    expect(screen.getByText("BC")).toHaveAttribute("aria-hidden", "true");
  });

  it("sizes the md logo larger than the sm one", () => {
    const { container, rerender } = render(
      <FantasyTeamLogo name="Better Call Gasol" logoUrl={LOGO_URL} size="sm" />,
    );
    const small = Number(container.querySelector("img")?.getAttribute("width") ?? 0);

    rerender(<FantasyTeamLogo name="Better Call Gasol" logoUrl={LOGO_URL} size="md" />);
    const medium = Number(container.querySelector("img")?.getAttribute("width") ?? 0);

    expect(small).toBeGreaterThan(0);
    expect(medium).toBeGreaterThan(small);
  });
});
