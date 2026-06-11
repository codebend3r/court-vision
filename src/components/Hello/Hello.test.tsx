import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Hello } from "./Hello";

describe("Hello", () => {
  it("renders the provided name", () => {
    render(<Hello name="CJ" />);

    expect(screen.getByText("Hello, CJ.")).toBeInTheDocument();
  });
});
