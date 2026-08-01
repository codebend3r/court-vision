"use client";

import { useId, useState } from "react";

import styles from "@/components/SettingsFantasy/SettingsFantasy.module.scss";
import { updatePreferences } from "@/lib/settings/actions";
import { ENABLED_METHODS, type FantasyMethodKey } from "@/lib/valuation/registry";

export type SettingsFantasyProps = {
  preferredFormula: FantasyMethodKey | null;
};

// null preferredFormula = "App default": no override, the app's own default
// formula wins. Selecting a method persists that override immediately —
// there is no submit button, saves are optimistic with revert-on-failure.
export function SettingsFantasy({ preferredFormula }: SettingsFantasyProps) {
  const headingId = useId();
  const [selected, setSelected] = useState<FantasyMethodKey | null>(preferredFormula);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const select = ({ key }: { key: FantasyMethodKey | null }) => {
    if (key === selected) return;
    const previous = selected;
    setSelected(key);
    void updatePreferences({ preferredFormula: key }).then((result) => {
      if (result.status !== "ok") {
        setSelected(previous);
        setErrorMessage("Could not save — try again.");
        return;
      }
      setErrorMessage(null);
    });
  };

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Fantasy
      </h2>
      {!!errorMessage && (
        <p role="alert" className={styles.error}>
          {errorMessage}
        </p>
      )}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Preferred value formula</legend>
        <div className={styles.option}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="preferredFormula"
              className={styles.radio}
              checked={selected === null}
              onChange={() => select({ key: null })}
            />
            <span className={styles.radioTitle}>App default</span>
          </label>
        </div>
        {ENABLED_METHODS.map((method) => {
          const descriptionId = `${headingId}-${method.key}-description`;
          return (
            <div key={method.key} className={styles.option}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="preferredFormula"
                  className={styles.radio}
                  checked={selected === method.key}
                  onChange={() => select({ key: method.key })}
                  aria-describedby={descriptionId}
                />
                <span className={styles.radioTitle}>{method.fullName}</span>
              </label>
              <p id={descriptionId} className={styles.radioDescription}>
                {method.description}
              </p>
            </div>
          );
        })}
      </fieldset>
    </section>
  );
}
