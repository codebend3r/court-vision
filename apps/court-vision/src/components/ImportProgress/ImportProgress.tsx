"use client";

import { useEffect, useState } from "react";

import styles from "@/components/ImportProgress/ImportProgress.module.scss";

const DEFAULT_STEPS: readonly string[] = [
  "Reading your Yahoo league",
  "Matching players to Court Vision",
  "Building every roster",
  "Almost there",
];

export type ImportProgressProps = {
  title: string;
  steps?: readonly string[];
  intervalMs?: number;
};

// Shown while a league import runs, which takes several seconds. The title is
// the one live announcement; the cycling step line is decorative reassurance
// and stays out of the accessibility tree, so a screen reader isn't read a new
// sentence every couple of seconds. The animation itself is gated behind the
// motion preference in the module.
export function ImportProgress({
  title,
  steps = DEFAULT_STEPS,
  intervalMs = 2400,
}: ImportProgressProps) {
  const [stepIndex, setStepIndex] = useState(0);

  // Walks the steps once and rests on the last, so a slow import reads as
  // "Almost there" rather than looping back to the start.
  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, steps.length]);

  return (
    <section className={styles.panel}>
      <p role="status" className={styles.title}>
        {title}
      </p>
      <span className={styles.stage} aria-hidden="true">
        <span className={styles.ripple} />
        <span className={styles.shadow} />
        <span className={styles.ball} />
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.sweep} />
      </span>
      <p className={styles.step} aria-hidden="true">
        {steps[stepIndex] ?? ""}
      </p>
    </section>
  );
}
