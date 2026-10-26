import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "bun:test";

import { useSeriesSelection } from "@/components/SeriesChart/useSeriesSelection";

afterEach(cleanup);

const KEYS = ["pts", "reb", "ast"] as const;

function Harness() {
  const selection = useSeriesSelection({ param: "stats", keys: KEYS, defaults: ["pts", "reb"] });
  return (
    <>
      <output aria-label="active">{selection.active.join(" ")}</output>
      <button type="button" onClick={() => selection.toggle({ key: "ast" })}>
        Toggle AST
      </button>
      <button type="button" onClick={() => selection.toggle({ key: "pts" })}>
        Toggle PTS
      </button>
      <button type="button" onClick={() => selection.toggleAll({ all: KEYS })}>
        {selection.hasActive ? "Clear all" : "Select all"}
      </button>
    </>
  );
}

type RenderHarnessProps = {
  searchParams?: Record<string, string>;
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
};

const renderHarness = ({ searchParams = {}, onUrlUpdate }: RenderHarnessProps = {}) =>
  render(<Harness />, {
    wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams, onUrlUpdate }),
  });

const activeText = () => screen.getByRole("status", { name: "active" }).textContent;

describe("useSeriesSelection", () => {
  it("falls back to the defaults when the param is absent", () => {
    renderHarness();
    expect(activeText()).toBe("pts reb");
  });

  it("reads an empty param as no series at all", () => {
    renderHarness({ searchParams: { stats: "" } });
    expect(activeText()).toBe("");
    expect(screen.getByRole("button", { name: "Select all" })).toBeInTheDocument();
  });

  it("drops unknown keys from a hand-edited URL", () => {
    renderHarness({ searchParams: { stats: "ast,bogus,,pts" } });
    expect(activeText()).toBe("ast pts");
  });

  it("appends a toggled-on key and writes the comma list back", async () => {
    const user = userEvent.setup();
    const updates: UrlUpdateEvent[] = [];
    renderHarness({ onUrlUpdate: (event) => updates.push(event) });

    await user.click(screen.getByRole("button", { name: "Toggle AST" }));

    expect(activeText()).toBe("pts reb ast");
    expect(updates.at(-1)?.queryString).toBe("?stats=pts,reb,ast");
  });

  it("removes a toggled-off key", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Toggle PTS" }));

    expect(activeText()).toBe("reb");
  });

  it("clears every key, writing an empty param, then selects them all again", async () => {
    const user = userEvent.setup();
    const updates: UrlUpdateEvent[] = [];
    renderHarness({ onUrlUpdate: (event) => updates.push(event) });

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(updates.at(-1)?.searchParams.get("stats")).toBe("");

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(updates.at(-1)?.searchParams.get("stats")).toBe("pts,reb,ast");
  });
});
