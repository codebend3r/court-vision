import { type ReactNode } from "react";

import { TeamChip } from "court-vision";

const Row = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "grid", gridAutoFlow: "column", justifyContent: "start", gap: "0.5rem", alignItems: "center" }}>
    {children}
  </div>
);

export const Default = () => (
  <Row>
    <TeamChip team="LAL" />
    <TeamChip team="BOS" />
    <TeamChip team="GSW" />
    <TeamChip team="DEN" />
    <TeamChip team="MIL" />
  </Row>
);

export const Small = () => (
  <Row>
    <TeamChip team="OKC" size="sm" />
    <TeamChip team="NYK" size="sm" />
    <TeamChip team="PHX" size="sm" />
    <TeamChip team="MIA" size="sm" />
  </Row>
);

export const UnknownTeam = () => (
  <Row>
    <TeamChip team="FA" />
  </Row>
);
