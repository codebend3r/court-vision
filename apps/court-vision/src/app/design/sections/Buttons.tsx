import specimen from "@/app/design/sections/specimen.module.scss";
import styles from "@/app/design/sections/Buttons.module.scss";

// Every pressable control is a keycap (the mixins in @vision/ui's
// styles/mixins.scss); one specimen per mixin, each standalone and disabled,
// plus its pressed state when it is a toggle.
const KEYCAPS: readonly {
  name: string;
  className: "keycap" | "keycapEngaged" | "keycapDanger" | "keycapPress";
  usedBy: string;
  pressable: boolean;
}[] = [
  {
    name: "Keycap",
    className: "keycap",
    usedBy: "keycap: page actions, pagers, the sign-in link, chart All / None",
    pressable: false,
  },
  {
    name: "Engaged",
    className: "keycapEngaged",
    usedBy:
      "keycap-engaged: pressed toggles (stat chips, filters, settings options, theme cards) and current views (stat tabs, team grouping, nav rail)",
    pressable: true,
  },
  {
    name: "Danger",
    className: "keycapDanger",
    usedBy: "keycap-danger: destructive actions (Delete league)",
    pressable: false,
  },
  {
    name: "Press",
    className: "keycapPress",
    usedBy:
      "keycap-press: primary submits, pressed in while held (sign in, create or save a league)",
    pressable: false,
  },
];

export function Buttons() {
  return (
    <>
      <div className={specimen.controlGroup}>
        <h3 className={specimen.groupTitle}>Standalone</h3>
        <div className={styles.buttonSpecimens}>
          {KEYCAPS.map((keycap) => (
            <div key={keycap.name} className={styles.buttonSpecimen}>
              <span className={specimen.specimenName}>
                {keycap.name} — {keycap.usedBy}
              </span>
              <div className={styles.buttonRow}>
                <button type="button" className={styles[keycap.className]}>
                  {keycap.name}
                </button>
                <button type="button" disabled className={styles[keycap.className]}>
                  Disabled
                </button>
                {keycap.pressable && (
                  <button type="button" aria-pressed="true" className={styles[keycap.className]}>
                    Pressed
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className={styles.buttonSpecimen}>
            <span className={specimen.specimenName}>Input buttons</span>
            <div className={styles.buttonRow}>
              <input type="submit" value="Save lineup" className={styles.keycapPress} />
              <input type="button" value="Preview stats" className={styles.keycap} />
              <input type="reset" value="Clear form" className={styles.keycap} />
            </div>
          </div>
        </div>
      </div>

      <div className={specimen.controlGroup}>
        <h3 className={specimen.groupTitle}>Button groups</h3>
        <div className={styles.buttonSpecimens}>
          <div className={styles.buttonSpecimen}>
            <span className={specimen.specimenName}>Toggle group — stat chips</span>
            <div className={styles.buttonGroup} role="group" aria-label="Toggle group">
              {["PTS", "REB", "AST", "STL"].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={index < 2}
                  className={styles.keycapEngaged}
                >
                  {label}
                </button>
              ))}
              <button type="button" className={styles.keycap}>
                Clear all
              </button>
            </div>
          </div>
          <div className={styles.buttonSpecimen}>
            <span className={specimen.specimenName}>Action group — primary flow</span>
            <div className={styles.buttonGroup} role="group" aria-label="Action group">
              <button type="button" className={styles.keycapPress}>
                Save team
              </button>
              <button type="button" className={styles.keycap}>
                Cancel
              </button>
              <button type="button" className={styles.keycapDanger}>
                Remove player
              </button>
            </div>
          </div>
          <div className={styles.buttonSpecimen}>
            <span className={specimen.specimenName}>Pager group — a keycap pair</span>
            <div className={styles.buttonGroup} role="group" aria-label="Pager group">
              <button type="button" className={styles.keycap}>
                Previous
              </button>
              <button type="button" disabled className={styles.keycap}>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
