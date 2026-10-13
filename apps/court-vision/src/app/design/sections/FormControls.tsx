import { Switch } from "@vision/ui/components/Switch/Switch";

import specimen from "@/app/design/sections/specimen.module.scss";
import styles from "@/app/design/sections/FormControls.module.scss";

const CONTROL_TOKENS: readonly string[] = [
  "--color-control-bg",
  "--color-control-border",
  "--color-control-accent",
  "--color-control-placeholder",
  "--color-focus-ring",
  "--control-height",
  "--control-size",
  "--control-radius",
  "--focus-ring-width",
  "--control-disabled-opacity",
];

const TEXT_INPUTS: readonly { type: string; placeholder: string }[] = [
  { type: "text", placeholder: "Jayson Tatum" },
  { type: "email", placeholder: "coach@courtvision.app" },
  { type: "password", placeholder: "Password" },
  { type: "search", placeholder: "Search players" },
  { type: "tel", placeholder: "(617) 555-0134" },
  { type: "url", placeholder: "https://nba.com" },
  { type: "number", placeholder: "23" },
];

const DATE_INPUTS: readonly { type: string; defaultValue: string }[] = [
  { type: "date", defaultValue: "2025-10-21" },
  { type: "time", defaultValue: "19:30" },
  { type: "datetime-local", defaultValue: "2025-10-21T19:30" },
  { type: "month", defaultValue: "2025-10" },
  { type: "week", defaultValue: "2025-W43" },
];

const POSITIONS: readonly string[] = [
  "Point guard",
  "Shooting guard",
  "Small forward",
  "Power forward",
  "Center",
];

const STAT_CATEGORIES: readonly string[] = ["Points", "Rebounds", "Assists", "Steals", "Blocks"];

export function FormControls() {
  return (
    <>
      <div className={styles.tokenChips}>
        {CONTROL_TOKENS.map((token) => (
          <code key={token} className={styles.tokenChip}>
            {token}
          </code>
        ))}
      </div>

      <div className={specimen.controlGroup}>
        <h3 className={specimen.groupTitle}>Text fields</h3>
        <div className={styles.specimenGrid}>
          {TEXT_INPUTS.map((spec) => (
            <label key={spec.type} className={styles.specimen}>
              <span className={specimen.specimenName}>{`type="${spec.type}"`}</span>
              <input type={spec.type} placeholder={spec.placeholder} className={styles.field} />
            </label>
          ))}
          <label className={styles.specimen}>
            <span className={specimen.specimenName}>{'type="text" disabled'}</span>
            <input type="text" placeholder="Disabled" disabled className={styles.field} />
          </label>
        </div>
      </div>

      <div className={specimen.controlGroup}>
        <h3 className={specimen.groupTitle}>Date and time</h3>
        <div className={styles.specimenGrid}>
          {DATE_INPUTS.map((spec) => (
            <label key={spec.type} className={styles.specimen}>
              <span className={specimen.specimenName}>{`type="${spec.type}"`}</span>
              <input type={spec.type} defaultValue={spec.defaultValue} className={styles.field} />
            </label>
          ))}
        </div>
      </div>

      <div className={specimen.controlGroup}>
        <h3 className={specimen.groupTitle}>Selection</h3>
        <div className={styles.specimenGrid}>
          <label className={styles.specimen}>
            <span className={specimen.specimenName}>select</span>
            <select className={styles.field} defaultValue="Small forward">
              {POSITIONS.map((position) => (
                <option key={position}>{position}</option>
              ))}
            </select>
          </label>
          <label className={styles.specimen}>
            <span className={specimen.specimenName}>select multiple</span>
            <select
              multiple
              size={STAT_CATEGORIES.length}
              defaultValue={["Points", "Assists"]}
              className={styles.fieldMultiple}
            >
              {STAT_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className={styles.specimen}>
            <span className={specimen.specimenName}>textarea</span>
            <textarea rows={4} placeholder="Scouting notes" className={styles.textarea} />
          </label>
        </div>
      </div>

      <div className={specimen.controlGroup}>
        <h3 className={specimen.groupTitle}>Toggles</h3>
        <div className={styles.specimenGrid}>
          <fieldset className={styles.fieldset}>
            <legend className={specimen.specimenName}>{'type="checkbox"'}</legend>
            <label className={styles.toggleRow}>
              <input type="checkbox" defaultChecked className={styles.checkbox} />
              Checked
            </label>
            <label className={styles.toggleRow}>
              <input type="checkbox" className={styles.checkbox} />
              Unchecked
            </label>
            <label className={styles.toggleRow}>
              <input type="checkbox" disabled className={styles.checkbox} />
              Disabled
            </label>
          </fieldset>
          <fieldset className={styles.fieldset}>
            <legend className={specimen.specimenName}>{'type="radio"'}</legend>
            <label className={styles.toggleRow}>
              <input type="radio" name="radio-demo" defaultChecked className={styles.radio} />
              Selected
            </label>
            <label className={styles.toggleRow}>
              <input type="radio" name="radio-demo" className={styles.radio} />
              Unselected
            </label>
            <label className={styles.toggleRow}>
              <input type="radio" name="radio-demo" disabled className={styles.radio} />
              Disabled
            </label>
          </fieldset>
          <fieldset className={styles.fieldset}>
            <legend className={specimen.specimenName}>Switch component</legend>
            <Switch label="On" defaultChecked />
            <Switch label="Off" />
            <Switch label="Disabled" disabled />
          </fieldset>
        </div>
      </div>

      <div className={specimen.controlGroup}>
        <h3 className={specimen.groupTitle}>Sliders and pickers</h3>
        <div className={styles.specimenGrid}>
          <label className={styles.specimen}>
            <span className={specimen.specimenName}>{'type="range"'}</span>
            <input type="range" min={0} max={100} defaultValue={66} className={styles.range} />
          </label>
          <label className={styles.specimen}>
            <span className={specimen.specimenName}>{'type="color"'}</span>
            <input type="color" defaultValue="#3fc3e8" className={styles.colorField} />
          </label>
          <label className={styles.specimen}>
            <span className={specimen.specimenName}>{'type="file"'}</span>
            <input type="file" className={styles.fileField} />
          </label>
        </div>
      </div>

      <p className={styles.note}>
        {
          'type="hidden" renders nothing and type="image" is a legacy graphical submit button; both are omitted.'
        }
      </p>
    </>
  );
}
