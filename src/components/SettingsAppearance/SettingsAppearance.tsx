"use client";

import { useId, useState } from "react";

import styles from "@/components/SettingsAppearance/SettingsAppearance.module.scss";
import { updatePreferences } from "@/lib/settings/actions";
import { FONT_SCALES, FONT_SCALE_LABELS, type FontScale } from "@/lib/settings/types";

export type SettingsAppearanceProps = {
  fontScale: FontScale;
};

// Font scale is applied app-wide the instant it's picked (document.documentElement's
// data-font-scale, the same attribute the root layout stamps from Profile.fontScale
// on the next full render) so the preview and the rest of the app change together
// with no flash on the next hard reload. Saves are optimistic with revert-on-failure.
export function SettingsAppearance({ fontScale }: SettingsAppearanceProps) {
  const headingId = useId();
  const [selected, setSelected] = useState<FontScale>(fontScale);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const select = ({ value }: { value: FontScale }) => {
    if (value === selected) return;
    const previous = selected;
    setSelected(value);
    document.documentElement.dataset.fontScale = value;
    void updatePreferences({ fontScale: value }).then((result) => {
      if (result.status !== "ok") {
        setSelected(previous);
        document.documentElement.dataset.fontScale = previous;
        setErrorMessage("Could not save — try again.");
        return;
      }
      setErrorMessage(null);
    });
  };

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Appearance
      </h2>
      {!!errorMessage && (
        <p role="alert" className={styles.error}>
          {errorMessage}
        </p>
      )}
      <div className={styles.grid}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Font size</legend>
          {FONT_SCALES.map((scale) => (
            <label key={scale} className={styles.radioLabel}>
              <input
                type="radio"
                name="fontScale"
                className={styles.radio}
                checked={selected === scale}
                onChange={() => select({ value: scale })}
              />
              {FONT_SCALE_LABELS[scale]}
            </label>
          ))}
        </fieldset>
        <section className={styles.preview} aria-label="Preview" data-font-scale={selected}>
          <p className={styles.previewHeading}>Court Vision</p>
          <p className={styles.previewBody}>
            Nikola Jokić is averaging a 26/12/9 line over his last 10 games.
          </p>
          <table className={styles.previewTable}>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">PTS</th>
                <th scope="col">REB</th>
                <th scope="col">AST</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>N. Jokić</td>
                <td>26.4</td>
                <td>12.1</td>
                <td>9.2</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}
