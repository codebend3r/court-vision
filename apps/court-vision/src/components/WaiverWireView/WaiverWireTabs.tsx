"use client";

import { type ReactNode } from "react";

import { KeycapTabs } from "@/components/KeycapTabs/KeycapTabs";
import { WAIVER_VIEWS, type WaiverView } from "@/lib/waiverWire/searchParams";

const TAB_LABELS: Record<WaiverView, string> = {
  available: "Available players",
  swap: "Swap board",
  h2h: "Head-to-head",
  cut: "Cut line",
};

type OnChangeProps = { view: WaiverView };

export type WaiverWireTabsProps = {
  view: WaiverView;
  onChange: ({ view }: OnChangeProps) => void;
  panels: Record<WaiverView, ReactNode>;
};

// The Waiver Wire's four views as keycap tabs.
export function WaiverWireTabs({ view, onChange, panels }: WaiverWireTabsProps) {
  return (
    <KeycapTabs
      label="Compare players"
      tabs={WAIVER_VIEWS}
      labels={TAB_LABELS}
      view={view}
      onChange={onChange}
      panels={panels}
    />
  );
}
