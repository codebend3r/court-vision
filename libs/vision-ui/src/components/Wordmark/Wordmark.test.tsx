import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { Wordmark } from "#ui/components/Wordmark/Wordmark";

afterEach(cleanup);

describe("Wordmark", () => {
  it("stacks the sport word over Vision", () => {
    render(<Wordmark lead="Rink" />);
    expect(screen.getByText("Rink")).toHaveClass("lead");
    expect(screen.getByText("Vision")).toHaveClass("trail");
    expect(screen.getByText("Rink").parentElement).toHaveClass("wordmark");
  });
});
