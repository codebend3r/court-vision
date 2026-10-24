"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

import { WAIVER_VIEWS, type WaiverView } from "@/lib/waiverWire/searchParams";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

const TAB_LABELS: Record<WaiverView, string> = {
  available: "Available players",
  swap: "Swap board",
  h2h: "Head-to-head",
  cut: "Cut line",
};

const LAST_INDEX = WAIVER_VIEWS.length - 1;

// The tab index each navigation key moves to from `index`; arrows wrap.
const KEY_TARGETS: Record<string, (index: number) => number> = {
  ArrowRight: (index) => (index === LAST_INDEX ? 0 : index + 1),
  ArrowLeft: (index) => (index === 0 ? LAST_INDEX : index - 1),
  Home: () => 0,
  End: () => LAST_INDEX,
};

export type WaiverWireTabsProps = {
  view: WaiverView;
  onChange: ({ view }: { view: WaiverView }) => void;
  panels: Record<WaiverView, ReactNode>;
};

// The Waiver Wire's four views as WAI-ARIA tabs with automatic
// activation: one tab stop (roving tabIndex), the arrow keys wrap, Home and
// End jump to the ends, and only the selected panel renders.
export function WaiverWireTabs({ view, onChange, panels }: WaiverWireTabsProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<WaiverView, HTMLButtonElement>());
  const tabId = ({ tab }: { tab: WaiverView }) => `${baseId}-tab-${tab}`;
  const panelId = ({ tab }: { tab: WaiverView }) => `${baseId}-panel-${tab}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const shownView = useRef(view);

  // A new view from outside the tabs (a free agent's name, the back button)
  // unmounts whatever had focus with the old panel. Hand focus to the
  // selected tab then, unless the user is already somewhere in the tabs.
  useEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    const active = document.activeElement;
    const isInTabs =
      active !== null &&
      active !== document.body &&
      (containerRef.current?.contains(active) ?? false);
    const tab = tabRefs.current.get(view);
    if (!isInTabs && tab) tab.focus();
  }, [view]);

  const onKeyDown = ({
    event,
    tab,
  }: {
    event: KeyboardEvent<HTMLButtonElement>;
    tab: WaiverView;
  }) => {
    const target = KEY_TARGETS[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = WAIVER_VIEWS[target(WAIVER_VIEWS.indexOf(tab))] ?? tab;
    tabRefs.current.get(next)?.focus();
    onChange({ view: next });
  };

  return (
    <div className={styles.tabs} ref={containerRef}>
      <div className={styles.tablist} role="tablist" aria-label="Compare players">
        {WAIVER_VIEWS.map((tab) => {
          const isSelected = tab === view;
          return (
            <button
              key={tab}
              ref={(node) => {
                if (node !== null) tabRefs.current.set(tab, node);
                return () => {
                  tabRefs.current.delete(tab);
                };
              }}
              type="button"
              role="tab"
              id={tabId({ tab })}
              aria-selected={isSelected}
              aria-controls={isSelected ? panelId({ tab }) : undefined}
              tabIndex={isSelected ? 0 : -1}
              className={styles.tab}
              onClick={() => onChange({ view: tab })}
              onKeyDown={(event) => onKeyDown({ event, tab })}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>
      <div
        className={styles.tabpanel}
        role="tabpanel"
        id={panelId({ tab: view })}
        aria-labelledby={tabId({ tab: view })}
        tabIndex={0}
      >
        {panels[view]}
      </div>
    </div>
  );
}
