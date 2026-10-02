import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ChartPlaceholder } from "@/components/ChartPlaceholder/ChartPlaceholder";

afterEach(cleanup);

describe("ChartPlaceholder", () => {
  it("renders a sized box that fills its container", () => {
    const { container } = render(<ChartPlaceholder />);
    expect(container.querySelector("[data-chart-placeholder]")).toHaveClass("placeholder");
  });

  it("is hidden from assistive tech", () => {
    const { container } = render(<ChartPlaceholder />);
    expect(container.querySelector("[data-chart-placeholder]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
