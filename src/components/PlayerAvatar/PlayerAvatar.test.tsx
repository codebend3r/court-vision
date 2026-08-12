import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";

afterEach(cleanup);

describe("PlayerAvatar", () => {
  it("renders the NBA CDN headshot image when nbaPersonId is present", () => {
    render(<PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="sm" />);

    const img = screen.getByRole("img", { name: "Anthony Edwards" });
    const src = decodeURIComponent(img.getAttribute("src") ?? "");
    expect(src).toContain("/headshots/nba/latest/1040x760/1630162.png");
  });

  it("sizes the sm image at 36px and the lg image at 72px", () => {
    const { rerender } = render(
      <PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="sm" />,
    );
    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveAttribute("width", "36");
    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveAttribute("height", "36");

    rerender(<PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="lg" />);
    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveAttribute("width", "72");
    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveAttribute("height", "72");
  });

  it("shows initials (no img element) when nbaPersonId is null", () => {
    const { container } = render(
      <PlayerAvatar fullName="Anthony Edwards" nbaPersonId={null} size="sm" />,
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
    const fallback = screen.getByRole("img", { name: "Anthony Edwards" });
    expect(fallback.tagName).not.toBe("IMG");
    expect(fallback).toHaveTextContent("AE");
  });

  it("uses the first and last word initials, uppercased", () => {
    render(<PlayerAvatar fullName="giannis antetokounmpo" nbaPersonId={null} size="sm" />);

    expect(screen.getByText("GA")).toBeInTheDocument();
  });

  it("falls back to a single initial for a single-word name", () => {
    render(<PlayerAvatar fullName="Zion" nbaPersonId={null} size="sm" />);

    expect(screen.getByText("Z")).toBeInTheDocument();
  });

  it("borders the image's wrapper with the team's primary color", () => {
    render(
      <PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="sm" teamAbbr="MIN" />,
    );

    // The stripe lives on the wrapper, never the img — a border on the img
    // itself would skew its box off the width/height attributes.
    // Minnesota Timberwolves primary, same source as TeamChip.
    const image = screen.getByRole("img", { name: "Anthony Edwards" });
    expect(image.parentElement).toHaveStyle({ borderLeftColor: "#0C2340" });
    expect(image).not.toHaveStyle({ borderLeftColor: "#0C2340" });
  });

  it("borders the initials fallback with the team's primary color", () => {
    render(<PlayerAvatar fullName="Anthony Edwards" nbaPersonId={null} size="sm" teamAbbr="MIN" />);

    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveStyle({
      borderLeftColor: "#0C2340",
    });
  });

  it("keeps the default border when the team is unknown or absent", () => {
    render(<PlayerAvatar fullName="Anthony Edwards" nbaPersonId={null} size="sm" teamAbbr="???" />);

    expect(screen.getByRole("img", { name: "Anthony Edwards" })).not.toHaveAttribute("style");
  });

  it("replaces the image with the initials fallback when the image errors", () => {
    const { container } = render(
      <PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="sm" />,
    );

    const img = screen.getByRole("img", { name: "Anthony Edwards" });
    fireEvent.error(img);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    const fallback = screen.getByRole("img", { name: "Anthony Edwards" });
    expect(fallback).toHaveTextContent("AE");
  });
});
