import { useEffect, useRef, type ReactNode } from "react";

import { FantasyValueLegend } from "court-vision";

// FantasyValueLegend is a <details> that ships collapsed; open it after mount
// so the card shows the method descriptions and the pool/weights copy that
// actually differ between the perGame and total variants.
const OpenLegend = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("details")?.setAttribute("open", "");
  }, []);
  return <div ref={ref}>{children}</div>;
};

export const PerGame = () => (
  <OpenLegend>
    <FantasyValueLegend poolSize={178} windowLabel="Last 30 days" basis="perGame" />
  </OpenLegend>
);

export const SeasonTotal = () => (
  <OpenLegend>
    <FantasyValueLegend poolSize={240} windowLabel="2024-25 season" basis="total" />
  </OpenLegend>
);
