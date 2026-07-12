import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InfoTip } from "@/components/InfoTip/InfoTip";

afterEach(cleanup);

describe("InfoTip", () => {
  it("labels the trigger for assistive tech and renders the tooltip content", () => {
    render(
      <InfoTip label="About qualifying minimums">
        <span>300 made field goals</span>
      </InfoTip>,
    );

    expect(screen.getByRole("button", { name: "About qualifying minimums" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("300 made field goals");
  });

  it("associates the trigger with its tooltip via aria-describedby", () => {
    render(
      <InfoTip label="More info">
        <span>Explanation</span>
      </InfoTip>,
    );

    const trigger = screen.getByRole("button", { name: "More info" });
    const tooltip = screen.getByRole("tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.getAttribute("id"));
  });
});
