import styles from "@/app/design/sections/BodyText.module.scss";

export function BodyText() {
  return (
    <>
      <div className={styles.prose}>
        <p>
          Court Vision surfaces the players <strong>trending</strong> in the categories you care
          about. Track a <em>hot streak</em> across the last ten games, or flag a{" "}
          <strong>
            <em>must-add breakout</em>
          </strong>{" "}
          before the rest of your league notices. Inline values like a <code>32.4%</code> usage rate
          stay legible in <a href="#colors">running copy</a>.
        </p>
        <p>
          Paragraphs set the body typeface at <code>--font-size-md</code> on a 1.5 line height.
          Reach for <strong>&lt;strong&gt;</strong> when a word needs weight and <em>&lt;em&gt;</em>{" "}
          when it needs emphasis; the two combine for the rare line that wants both.
        </p>
      </div>
      <div className={styles.emphasisGrid}>
        <p className={styles.emphasisSample}>Regular weight, roman</p>
        <p className={styles.emphasisBold}>Bold weight</p>
        <p className={styles.emphasisItalic}>Italic style</p>
        <p className={styles.emphasisBoldItalic}>Bold and italic</p>
      </div>
    </>
  );
}
