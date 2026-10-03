"use client";

import { useId, type ReactNode } from "react";

import styles from "@/components/InfoTip/InfoTip.module.scss";

export type InfoTipProps = {
  // Describes what the icon reveals, for screen readers and the pointer label.
  label: string;
  children: ReactNode;
};

export function InfoTip({ label, children }: InfoTipProps) {
  const tooltipId = useId();
  return (
    <span className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-describedby={tooltipId}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
          <path
            d="M8 7.2v4.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span role="tooltip" id={tooltipId} className={styles.bubble}>
        {children}
      </span>
    </span>
  );
}
