import { InfoTip } from "court-vision";

const Label = ({ text, tip }: { text: string; tip: string }) => (
  <span
    style={{
      display: "grid",
      gridAutoFlow: "column",
      justifyContent: "start",
      gap: "0.375rem",
      alignItems: "center",
      color: "var(--color-text)",
      fontSize: "var(--font-size-sm)",
      fontWeight: 600,
    }}
  >
    {text}
    <InfoTip label={`What is ${text}?`}>{tip}</InfoTip>
  </span>
);

export const InContext = () => (
  <Label text="Z-Score" tip="Distance from the average pool player in each category, summed with your weights." />
);

export const MultipleTips = () => (
  <div style={{ display: "grid", gap: "0.75rem", justifyContent: "start" }}>
    <Label text="PIE" tip="Share of all positive game events the player accounts for while on the floor." />
    <Label text="Usage" tip="The percentage of team plays a player uses while on the court." />
    <Label text="VORP" tip="Z-Score surplus over the last rostered player in your league." />
  </div>
);
