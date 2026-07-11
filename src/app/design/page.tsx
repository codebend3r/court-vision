import { ChartPaletteSwatches } from "@/components/ChartPaletteSwatches/ChartPaletteSwatches";
import { TokenSwatch } from "@/components/TokenSwatch/TokenSwatch";

import styles from "@/app/design/page.module.scss";

const COLOR_TOKENS: readonly string[] = [
  "--color-bg",
  "--color-surface",
  "--color-border",
  "--color-text",
  "--color-text-muted",
  "--color-accent",
  "--color-accent-strong",
  "--color-highlight",
];

const TYPOGRAPHY_TOKENS: readonly string[] = [
  "--font-size-sm",
  "--font-size-md",
  "--font-size-lg",
  "--font-size-xl",
];

const SPACING_TOKENS: readonly string[] = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-6",
  "--space-8",
];

const RADIUS_TOKENS: readonly string[] = ["--radius-sm", "--radius-md", "--radius-lg"];

const TYPEFACES: readonly { name: string; cssVar: string }[] = [
  { name: "Chakra Petch — display", cssVar: "--font-display" },
  { name: "IBM Plex Sans — body", cssVar: "--font-sans" },
];

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5"] as const;

const WEIGHT_FAMILIES: readonly {
  name: string;
  cssVar: string;
  weights: readonly { token: string; value: number }[];
}[] = [
  {
    name: "Chakra Petch — display",
    cssVar: "--font-display",
    weights: [
      { token: "--font-weight-regular", value: 400 },
      { token: "--font-weight-medium", value: 500 },
      { token: "--font-weight-bold", value: 700 },
    ],
  },
  {
    name: "IBM Plex Sans — body",
    cssVar: "--font-sans",
    weights: [
      { token: "--font-weight-regular", value: 400 },
      { token: "--font-weight-medium", value: 500 },
      { token: "--font-weight-semibold", value: 600 },
    ],
  },
];

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

export default function DesignPage() {
  return (
    <main className={styles.page}>
      <h1>Design system</h1>

      <section className={styles.section}>
        <h2>Colors</h2>
        <div className={styles.colorGrid}>
          {COLOR_TOKENS.map((token) => (
            <TokenSwatch key={token} token={token} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Chart palettes</h2>
        <ChartPaletteSwatches />
      </section>

      <section className={styles.section}>
        <h2>Typography</h2>
        <div className={styles.typeStack}>
          {TYPOGRAPHY_TOKENS.map((token) => (
            <p key={token} className={styles.typeSample} style={{ fontSize: `var(${token})` }}>
              {token}
            </p>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Typefaces</h2>
        <div className={styles.typefaceStack}>
          {TYPEFACES.map((typeface) => (
            <p
              key={typeface.cssVar}
              className={styles.typefaceSample}
              style={{ fontFamily: `var(${typeface.cssVar})` }}
            >
              {typeface.name}
            </p>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Headings</h2>
        <div className={styles.headingStack}>
          {HEADING_TAGS.map((tag) => {
            const HeadingTag = tag;
            return (
              <div key={tag} className={styles.headingRow}>
                <span className={styles.specimenName}>{tag}</span>
                <HeadingTag className={styles.headingSample}>Fourth quarter comeback</HeadingTag>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Font weights</h2>
        <div className={styles.weightStack}>
          {WEIGHT_FAMILIES.map((family) => (
            <div key={family.cssVar} className={styles.weightFamily}>
              <h3 className={styles.groupTitle}>{family.name}</h3>
              {family.weights.map((weight) => (
                <div key={weight.token} className={styles.weightRow}>
                  <span className={styles.specimenName}>{`${weight.token} (${weight.value})`}</span>
                  <p
                    className={styles.weightSample}
                    style={{
                      fontFamily: `var(${family.cssVar})`,
                      fontWeight: `var(${weight.token})`,
                    }}
                  >
                    Triple double: 32 pts, 11 reb, 10 ast
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Spacing</h2>
        <div className={styles.spacingStack}>
          {SPACING_TOKENS.map((token) => (
            <div key={token} className={styles.spacingRow}>
              <span className={styles.spacingBar} style={{ width: `var(${token})` }} />
              <span className={styles.spacingLabel}>{token}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Radius</h2>
        <div className={styles.radiusGrid}>
          {RADIUS_TOKENS.map((token) => (
            <div key={token} className={styles.radiusTile}>
              <div className={styles.radiusSwatch} style={{ borderRadius: `var(${token})` }} />
              <span className={styles.radiusLabel}>{token}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Form controls</h2>
        <div className={styles.tokenChips}>
          {CONTROL_TOKENS.map((token) => (
            <code key={token} className={styles.tokenChip}>
              {token}
            </code>
          ))}
        </div>

        <div className={styles.controlGroup}>
          <h3 className={styles.groupTitle}>Text fields</h3>
          <div className={styles.specimenGrid}>
            {TEXT_INPUTS.map((spec) => (
              <label key={spec.type} className={styles.specimen}>
                <span className={styles.specimenName}>{`type="${spec.type}"`}</span>
                <input type={spec.type} placeholder={spec.placeholder} className={styles.field} />
              </label>
            ))}
            <label className={styles.specimen}>
              <span className={styles.specimenName}>{'type="text" disabled'}</span>
              <input type="text" placeholder="Disabled" disabled className={styles.field} />
            </label>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <h3 className={styles.groupTitle}>Date and time</h3>
          <div className={styles.specimenGrid}>
            {DATE_INPUTS.map((spec) => (
              <label key={spec.type} className={styles.specimen}>
                <span className={styles.specimenName}>{`type="${spec.type}"`}</span>
                <input type={spec.type} defaultValue={spec.defaultValue} className={styles.field} />
              </label>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <h3 className={styles.groupTitle}>Selection</h3>
          <div className={styles.specimenGrid}>
            <label className={styles.specimen}>
              <span className={styles.specimenName}>select</span>
              <select className={styles.field} defaultValue="Small forward">
                {POSITIONS.map((position) => (
                  <option key={position}>{position}</option>
                ))}
              </select>
            </label>
            <label className={styles.specimen}>
              <span className={styles.specimenName}>select multiple</span>
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
              <span className={styles.specimenName}>textarea</span>
              <textarea rows={4} placeholder="Scouting notes" className={styles.textarea} />
            </label>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <h3 className={styles.groupTitle}>Toggles</h3>
          <div className={styles.specimenGrid}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.specimenName}>{'type="checkbox"'}</legend>
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
              <legend className={styles.specimenName}>{'type="radio"'}</legend>
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
          </div>
        </div>

        <div className={styles.controlGroup}>
          <h3 className={styles.groupTitle}>Sliders and pickers</h3>
          <div className={styles.specimenGrid}>
            <label className={styles.specimen}>
              <span className={styles.specimenName}>{'type="range"'}</span>
              <input type="range" min={0} max={100} defaultValue={66} className={styles.range} />
            </label>
            <label className={styles.specimen}>
              <span className={styles.specimenName}>{'type="color"'}</span>
              <input type="color" defaultValue="#3fc3e8" className={styles.colorField} />
            </label>
            <label className={styles.specimen}>
              <span className={styles.specimenName}>{'type="file"'}</span>
              <input type="file" className={styles.fileField} />
            </label>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <h3 className={styles.groupTitle}>Buttons</h3>
          <div className={styles.buttonRow}>
            <input type="submit" value="Save lineup" className={styles.buttonPrimary} />
            <input type="button" value="Preview stats" className={styles.buttonSecondary} />
            <input type="reset" value="Clear form" className={styles.buttonGhost} />
            <input type="button" value="Disabled" disabled className={styles.buttonSecondary} />
          </div>
        </div>

        <p className={styles.note}>
          {
            'type="hidden" renders nothing and type="image" is a legacy graphical submit button; both are omitted.'
          }
        </p>
      </section>
    </main>
  );
}
