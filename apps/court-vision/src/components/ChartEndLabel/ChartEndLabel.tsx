import { type ReactElement } from "react";

// What recharts hands a label renderer for each point of a line: its resolved
// position and its index in the data.
export type EndLabelProps = { x?: number | string; y?: number | string; index?: number };

// The index of the last row that has a plotted value for `key`, or -1. A line
// can end before the chart does (trailing missed games, a player who stopped
// appearing), and its name belongs beside its own last point.
type LastPlottedIndexProps<K extends keyof Row, Row> = {
  rows: readonly Row[];
  key: K;
};

export const lastPlottedIndex = <Row, K extends keyof Row>({
  rows,
  key,
}: LastPlottedIndexProps<K, Row>): number =>
  rows.reduce((last, row, index) => (typeof row[key] === "number" ? index : last), -1);

// Names a line beside its last point: pass the result as a `Line`'s `label`
// or a `LabelList`'s `content`. `baseline: "middle"` centres the text on the
// point; the default sits it just below, on its alphabetic baseline.
type endLabelProps = {
  text: string;
  lastIndex: number;
  fill: string;
  baseline?: "alphabetic" | "middle";
};

export const endLabel = ({ text, lastIndex, fill, baseline = "alphabetic" }: endLabelProps) =>
  // Named rather than a bare arrow: recharts renders this as a component, and
  // an anonymous one has no display name in the tree.
  function EndLabel({ x, y, index }: EndLabelProps): ReactElement | null {
    const left = Number(x);
    const top = Number(y);
    if (index !== lastIndex || !Number.isFinite(left) || !Number.isFinite(top)) {
      return null;
    }
    return baseline === "middle" ? (
      <text x={left + 8} y={top} fill={fill} fontSize={12} dominantBaseline="middle">
        {text}
      </text>
    ) : (
      <text x={left + 8} y={top + 4} fill={fill} fontSize={12}>
        {text}
      </text>
    );
  };
