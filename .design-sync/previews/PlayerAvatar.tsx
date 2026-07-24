import { type ReactNode } from "react";

import { PlayerAvatar } from "court-vision";

const Row = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "grid", gridAutoFlow: "column", justifyContent: "start", gap: "1rem", alignItems: "center" }}>
    {children}
  </div>
);

export const Large = () => (
  <Row>
    <PlayerAvatar fullName="Nikola Jokic" nbaPersonId={203999} size="lg" teamAbbr="DEN" />
    <PlayerAvatar fullName="Shai Gilgeous-Alexander" nbaPersonId={1628983} size="lg" teamAbbr="OKC" />
  </Row>
);

export const Small = () => (
  <Row>
    <PlayerAvatar fullName="Stephen Curry" nbaPersonId={201939} size="sm" teamAbbr="GSW" />
    <PlayerAvatar fullName="Jayson Tatum" nbaPersonId={1628369} size="sm" teamAbbr="BOS" />
    <PlayerAvatar fullName="Anthony Edwards" nbaPersonId={1630162} size="sm" teamAbbr="MIN" />
  </Row>
);

// No headshot id -> initials fallback with the team-colored ring.
export const InitialsFallback = () => (
  <Row>
    <PlayerAvatar fullName="Victor Wembanyama" nbaPersonId={null} size="lg" teamAbbr="SAS" />
    <PlayerAvatar fullName="Free Agent" nbaPersonId={null} size="lg" teamAbbr={null} />
  </Row>
);
