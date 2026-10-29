"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

import styles from "@/components/KeycapTabs/KeycapTabs.module.scss";

type OnChangeProps<T extends string> = { view: T };

export type KeycapTabsProps<T extends string> = {
  // The tablist's accessible name.
  label: string;
  tabs: readonly T[];
  labels: Record<T, string>;
  view: T;
  onChange: ({ view }: OnChangeProps<T>) => void;
  panels: Record<T, ReactNode>;
};

// A page's views as WAI-ARIA tabs with automatic activation, drawn as
// keycaps: one tab stop (roving tabIndex), the arrow keys wrap, Home and End
// jump to the ends, and only the selected panel renders.
export function KeycapTabs<T extends string>({
  label,
  tabs,
  labels,
  view,
  onChange,
  panels,
}: KeycapTabsProps<T>) {
  const baseId = useId();
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  type IdProps = { tab: T };

  const tabId = ({ tab }: IdProps) => `${baseId}-tab-${tab}`;
  const panelId = ({ tab }: IdProps) => `${baseId}-panel-${tab}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const shownView = useRef(view);
  const lastIndex = tabs.length - 1;

  // A new view from outside the tabs (a link, the back button) unmounts
  // whatever had focus with the old panel. Hand focus to the selected tab
  // then, unless the user is already somewhere in the tabs.
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

  // The tab index each navigation key moves to from `index`; arrows wrap.
  const keyTargets: Record<string, (index: number) => number> = {
    ArrowRight: (index) => (index === lastIndex ? 0 : index + 1),
    ArrowLeft: (index) => (index === 0 ? lastIndex : index - 1),
    Home: () => 0,
    End: () => lastIndex,
  };

  type OnKeyDownProps = { event: KeyboardEvent<HTMLButtonElement>; tab: T };

  const onKeyDown = ({ event, tab }: OnKeyDownProps) => {
    const target = keyTargets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = tabs[target(tabs.indexOf(tab))] ?? tab;
    tabRefs.current.get(next)?.focus();
    onChange({ view: next });
  };

  return (
    <div className={styles.tabs} ref={containerRef}>
      <div className={styles.tablist} role="tablist" aria-label={label}>
        {tabs.map((tab) => {
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
              {labels[tab]}
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
