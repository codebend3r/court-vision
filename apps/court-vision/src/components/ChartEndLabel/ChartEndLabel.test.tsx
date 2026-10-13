import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { endLabel, lastPlottedIndex } from "@/components/ChartEndLabel/ChartEndLabel";

afterEach(cleanup);

const renderInSvg = (element: ReturnType<ReturnType<typeof endLabel>>) =>
  render(<svg>{element}</svg>).container;

describe("lastPlottedIndex", () => {
  it("finds the last row holding a number for the key", () => {
    const rows = [{ pts: 1 }, { pts: 2 }, { pts: null }];
    expect(lastPlottedIndex({ rows, key: "pts" })).toBe(1);
  });

  it("skips rows where the key is missing", () => {
    const rows: Array<Record<string, number | undefined>> = [{ p1: 1 }, { p1: undefined }, {}];
    expect(lastPlottedIndex({ rows, key: "p1" })).toBe(0);
  });

  it("returns -1 when nothing is plotted", () => {
    expect(lastPlottedIndex({ rows: [{ pts: null }], key: "pts" })).toBe(-1);
  });
});

describe("endLabel", () => {
  it("draws the text beside the last point only", () => {
    const EndLabel = endLabel({ text: "PTS", lastIndex: 2, fill: "#fff" });

    expect(renderInSvg(EndLabel({ x: 100, y: 50, index: 1 })).querySelector("text")).toBeNull();

    const text = renderInSvg(EndLabel({ x: 100, y: 50, index: 2 })).querySelector("text");
    expect(text).toHaveTextContent("PTS");
    expect(text).toHaveAttribute("x", "108");
    expect(text).toHaveAttribute("y", "54");
    expect(text).toHaveAttribute("fill", "#fff");
  });

  it("centres the text on the point when asked", () => {
    const EndLabel = endLabel({ text: "Brunson", lastIndex: 0, fill: "#000", baseline: "middle" });
    const text = renderInSvg(EndLabel({ x: 10, y: 20, index: 0 })).querySelector("text");

    expect(text).toHaveAttribute("y", "20");
    expect(text).toHaveAttribute("dominant-baseline", "middle");
  });

  it("draws nothing without a resolved position", () => {
    const EndLabel = endLabel({ text: "PTS", lastIndex: 0, fill: "#fff" });
    expect(renderInSvg(EndLabel({ index: 0 })).querySelector("text")).toBeNull();
  });
});
