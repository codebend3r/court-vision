import styles from "@/components/Logo/Logo.module.scss";

// The court plate: the floor plan seen from above on a 48-unit grid, drawn in
// --color-accent with detail knocked out in --color-bg so it re-inks per
// theme. Detail drops at two size thresholds rather than letting the renderer
// scale one asset — arcs go first, then the circle, and the stroke thickens
// as the plate shrinks.
type MarkTier = {
  stroke: number;
  showArcs: boolean;
  showCircle: boolean;
};

const tierFor = ({ size }: { size: number }): MarkTier => {
  if (size >= 32) return { stroke: 3, showArcs: true, showCircle: true };
  if (size >= 20) return { stroke: 4, showArcs: false, showCircle: true };
  return { stroke: 6, showArcs: false, showCircle: false };
};

export function LogoMark({ size }: { size: number }) {
  const { stroke, showArcs, showCircle } = tierFor({ size });
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={styles.mark}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="8" width="42" height="32" rx="3" fill="var(--color-accent)" />
      <line x1="24" y1="8" x2="24" y2="40" stroke="var(--color-bg)" strokeWidth={stroke} />
      {showCircle && (
        <circle cx="24" cy="24" r="7" stroke="var(--color-bg)" strokeWidth={stroke} fill="none" />
      )}
      {showArcs && (
        <path
          d="M3 15 A 12 9 0 0 1 3 33"
          stroke="var(--color-bg)"
          strokeWidth={stroke}
          fill="none"
        />
      )}
      {showArcs && (
        <path
          d="M45 15 A 12 9 0 0 0 45 33"
          stroke="var(--color-bg)"
          strokeWidth={stroke}
          fill="none"
        />
      )}
    </svg>
  );
}

// COURT over VISION. The two lines carry the extrusion; VISION takes the
// accent so the wordmark re-inks with the theme like the mark does.
export function LogoWordmark() {
  return (
    <span className={styles.wordmark}>
      <span className={styles.wordCourt}>Court</span>
      <span className={styles.wordVision}>Vision</span>
    </span>
  );
}

// Header lockup: 34px plate beside a 14px two-line wordmark. Sign-in card:
// 72px plate above a centred 20px wordmark with wider tracking.
export function LogoLockup({
  orientation = "horizontal",
}: {
  orientation?: "horizontal" | "vertical";
}) {
  const vertical = orientation === "vertical";
  return (
    <span className={vertical ? styles.lockupVertical : styles.lockup}>
      <LogoMark size={vertical ? 72 : 34} />
      <LogoWordmark />
    </span>
  );
}
