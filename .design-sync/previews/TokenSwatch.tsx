import { type ReactNode } from "react";

import { TokenSwatch } from "court-vision";

const Grid = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
    {children}
  </div>
);

export const BrandColors = () => (
  <Grid>
    <TokenSwatch token="--color-accent" />
    <TokenSwatch token="--color-accent-strong" />
    <TokenSwatch token="--color-highlight" />
  </Grid>
);

export const StatusColors = () => (
  <Grid>
    <TokenSwatch token="--color-win" />
    <TokenSwatch token="--color-loss" />
    <TokenSwatch token="--color-accent-purple" />
  </Grid>
);

export const PositionColors = () => (
  <Grid>
    <TokenSwatch token="--color-position-g" />
    <TokenSwatch token="--color-position-f" />
    <TokenSwatch token="--color-position-c" />
  </Grid>
);

export const Surfaces = () => (
  <Grid>
    <TokenSwatch token="--color-bg" />
    <TokenSwatch token="--color-surface" />
    <TokenSwatch token="--color-border" />
  </Grid>
);
