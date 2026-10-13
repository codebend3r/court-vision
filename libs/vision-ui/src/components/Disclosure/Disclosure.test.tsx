import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { Disclosure } from "#ui/components/Disclosure/Disclosure";

afterEach(cleanup);

describe("Disclosure", () => {
  it("renders a native details whose summary leads with a decorative chevron", () => {
    const { container } = render(
      <Disclosure summary="Roster settings" className="box" summaryClassName="row">
        <p>Slot counts</p>
      </Disclosure>,
    );

    const details = container.querySelector("details");
    const summary = container.querySelector("summary");
    expect(details).toHaveClass("disclosure");
    expect(details).toHaveClass("box");
    expect(summary).toHaveClass("row");
    expect(summary).toHaveTextContent("▸Roster settings");
    expect(summary?.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(details?.open).toBe(false);
  });

  it("reveals its content when the summary is activated", () => {
    const { container } = render(
      <Disclosure summary="Roster settings">
        <p>Slot counts</p>
      </Disclosure>,
    );

    fireEvent.click(screen.getByText("Roster settings"));

    expect(container.querySelector("details")?.open).toBe(true);
  });

  it("starts open when asked and still folds", () => {
    const { container } = render(
      <Disclosure summary="Game log" open>
        <p>Rows</p>
      </Disclosure>,
    );

    const details = container.querySelector("details");
    expect(details?.open).toBe(true);
    fireEvent.click(screen.getByText("Game log"));
    expect(details?.open).toBe(false);
  });
});
