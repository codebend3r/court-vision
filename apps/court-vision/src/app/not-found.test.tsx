import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import NotFound from "@/app/not-found";

afterEach(cleanup);

describe("NotFound", () => {
  it("opens with a single h1 and a link home", () => {
    render(<NotFound />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Out of bounds" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("announces the error code as text, not only as a big number", () => {
    render(<NotFound />);

    expect(screen.getByRole("region", { name: "Error 404" })).toBeInTheDocument();
  });

  it("offers the main sections as a way back in", () => {
    render(<NotFound />);

    const nav = screen.getByRole("navigation", { name: "Get back in the game" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Players/ })).toHaveAttribute("href", "/players");
    expect(screen.getByRole("link", { name: /Teams/ })).toHaveAttribute("href", "/teams");
    expect(screen.getByRole("link", { name: /Fantasy League/ })).toHaveAttribute(
      "href",
      "/my-teams",
    );
    expect(screen.getByRole("link", { name: /Leagues/ })).toHaveAttribute("href", "/leagues");
  });
});
