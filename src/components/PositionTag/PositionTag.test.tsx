import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PositionTag } from "@/components/PositionTag/PositionTag";

afterEach(cleanup);

describe("PositionTag", () => {
  it("renders a single position group", () => {
    render(<PositionTag position="G" />);
    expect(screen.getByText("G")).toBeInTheDocument();
  });

  it("splits a hyphenated eligibility into separately-styled segments", () => {
    const { container } = render(<PositionTag position="G-F" />);
    // Each group renders in its own span, with a separator between them.
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
    const guard = screen.getByText("G");
    const forward = screen.getByText("F");
    expect(guard.className).not.toBe(forward.className);
    expect(container.textContent).toBe("G-F");
  });
});
