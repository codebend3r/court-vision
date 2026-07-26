import { type ReactNode } from "react";

import { TeamMatchup } from "court-vision";

const Stack = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "grid", gap: "0.75rem", justifyContent: "start" }}>{children}</div>
);

export const Home = () => (
  <Stack>
    <TeamMatchup matchup="LAL vs. BOS" />
    <TeamMatchup matchup="DEN vs. MIN" />
  </Stack>
);

export const Away = () => (
  <Stack>
    <TeamMatchup matchup="GSW @ PHX" />
    <TeamMatchup matchup="NYK @ MIL" />
  </Stack>
);

export const Small = () => (
  <Stack>
    <TeamMatchup matchup="OKC vs. DAL" size="sm" />
    <TeamMatchup matchup="MIA @ ORL" size="sm" />
  </Stack>
);
