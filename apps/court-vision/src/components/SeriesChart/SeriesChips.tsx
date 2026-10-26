"use client";

import { type ReactNode } from "react";

import { type SeriesSelection } from "@/components/SeriesChart/useSeriesSelection";

import styles from "@/components/SeriesChart/SeriesChart.module.scss";

export type SeriesChip<K extends string> = {
  key: K;
  label: string;
  // What carries the series' identity beside its label: a stat icon or a line
  // swatch in the series colour. Decorative, so it should be aria-hidden.
  mark: ReactNode;
  // The series' full name, shown on hover.
  title?: string;
  // A series the current mode cannot plot; it reads as unpressed.
  disabled?: boolean;
};

// The toggle row above a series chart: one pressed/unpressed keycap per series
// and a bulk "Clear all / Select all" companion at the end.
type SeriesChipsProps<K extends string> = {
  chips: readonly SeriesChip<K>[];
  selection: SeriesSelection<K>;
  // What "Select all" turns on.
  all: readonly K[];
};

export function SeriesChips<K extends string>({ chips, selection, all }: SeriesChipsProps<K>) {
  return (
    <div className={styles.chips}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-pressed={selection.isActive({ key: chip.key }) && !chip.disabled}
          disabled={chip.disabled}
          onClick={() => selection.toggle({ key: chip.key })}
          title={chip.title}
          className={styles.chip}
        >
          {chip.mark}
          {chip.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => selection.toggleAll({ all })}
        className={styles.chipAction}
      >
        {selection.hasActive ? "Clear all" : "Select all"}
      </button>
    </div>
  );
}
