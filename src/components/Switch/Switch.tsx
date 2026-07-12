"use client";

import { type ChangeEvent } from "react";

import styles from "@/components/Switch/Switch.module.scss";

export type SwitchProps = {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: ({ checked }: { checked: boolean }) => void;
};

export function Switch({ label, checked, defaultChecked, disabled, onChange }: SwitchProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.({ checked: event.target.checked });
  };

  return (
    <label className={styles.switch}>
      <input
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={handleChange}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.legendOn}>I</span>
        <span className={styles.legendOff}>O</span>
        <span className={styles.thumb} />
      </span>
      {label}
    </label>
  );
}
