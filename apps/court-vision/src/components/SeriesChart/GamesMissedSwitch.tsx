"use client";

import { parseAsBoolean, useQueryState } from "nuqs";

import { Switch } from "@vision/ui/components/Switch/Switch";

const showDnpParser = parseAsBoolean.withDefault(false);

// Whether the player charts mark zero-minute games, shared through `?dnp=true`
// so every chart on the page and the switch that drives them agree.
export const useShowDnp = (): { showDnp: boolean; setShowDnp: (next: boolean) => void } => {
  const [showDnp, setValue] = useQueryState("dnp", showDnpParser);
  return { showDnp, setShowDnp: (next) => void setValue(next) };
};

export function GamesMissedSwitch() {
  const { showDnp, setShowDnp } = useShowDnp();
  return (
    <Switch
      label="Games missed"
      checked={showDnp}
      onChange={({ checked }) => setShowDnp(checked)}
    />
  );
}
