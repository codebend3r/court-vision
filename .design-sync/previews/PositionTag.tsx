import { type ReactNode } from "react";

import { PositionTag } from "court-vision";

const Row = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      display: "grid",
      gridAutoFlow: "column",
      justifyContent: "start",
      gap: "1rem",
      alignItems: "center",
      fontFamily: "var(--font-display)",
      fontSize: "var(--font-size-lg)",
      fontWeight: 700,
    }}
  >
    {children}
  </div>
);

export const Guard = () => (
  <Row>
    <PositionTag position="G" />
  </Row>
);

export const EligibilityGroups = () => (
  <Row>
    <PositionTag position="G" />
    <PositionTag position="F" />
    <PositionTag position="C" />
  </Row>
);

export const Combos = () => (
  <Row>
    <PositionTag position="G-F" />
    <PositionTag position="F-C" />
    <PositionTag position="G-F-C" />
  </Row>
);
