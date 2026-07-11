import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";

afterEach(cleanup);

describe("PlayerAvatar", () => {
  it("renders the NBA CDN headshot image when nbaPersonId is present", () => {
    render(<PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="sm" />);

    const img = screen.getByRole("img", { name: "Anthony Edwards" });
    const src = decodeURIComponent(img.getAttribute("src") ?? "");
    expect(src).toContain("/headshots/nba/latest/1040x760/1630162.png");
  });

  it("sizes the sm image at 32px and the lg image at 96px", () => {
    const { rerender } = render(
      <PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="sm" />,
    );
    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveAttribute("width", "32");
    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveAttribute("height", "32");

    rerender(<PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="lg" />);
    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveAttribute("width", "96");
    expect(screen.getByRole("img", { name: "Anthony Edwards" })).toHaveAttribute("height", "96");
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
