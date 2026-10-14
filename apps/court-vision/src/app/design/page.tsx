import { type ComponentType } from "react";

import { BodyText } from "@/app/design/sections/BodyText";
import { Buttons } from "@/app/design/sections/Buttons";
import { Colors } from "@/app/design/sections/Colors";
import { FontWeights } from "@/app/design/sections/FontWeights";
import { FormControls } from "@/app/design/sections/FormControls";
import { Headings } from "@/app/design/sections/Headings";
import { Radius } from "@/app/design/sections/Radius";
import { Spacing } from "@/app/design/sections/Spacing";
import { TeamChips } from "@/app/design/sections/TeamChips";
import { Typefaces } from "@/app/design/sections/Typefaces";
import { Typography } from "@/app/design/sections/Typography";
import { ChartPaletteSwatches } from "@/components/ChartPaletteSwatches/ChartPaletteSwatches";
import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";

import styles from "@/app/design/page.module.scss";

// One list drives both the jump nav and the sections, so the two can't drift.
const SECTIONS: readonly { id: string; label: string; Body: ComponentType }[] = [
  { id: "colors", label: "Colors", Body: Colors },
  { id: "chart-palettes", label: "Chart palettes", Body: ChartPaletteSwatches },
  { id: "team-chips", label: "Team chips", Body: TeamChips },
  { id: "typography", label: "Typography", Body: Typography },
  { id: "typefaces", label: "Typefaces", Body: Typefaces },
  { id: "headings", label: "Headings", Body: Headings },
  { id: "font-weights", label: "Font weights", Body: FontWeights },
  { id: "body-text", label: "Body text", Body: BodyText },
  { id: "spacing", label: "Spacing", Body: Spacing },
  { id: "radius", label: "Radius", Body: Radius },
  { id: "form-controls", label: "Form controls", Body: FormControls },
  { id: "buttons", label: "Buttons", Body: Buttons },
];

export default function DesignPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Reference"
        title="Design system"
        description="Every token, typeface and control the app is built from, rendered live in the current theme."
      />

      <nav className={styles.sectionNav} aria-label="Design system sections">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className={styles.sectionLink}>
            {section.label}
          </a>
        ))}
      </nav>

      {SECTIONS.map(({ id, label, Body }) => (
        <section key={id} id={id} className={styles.section}>
          <h2>{label}</h2>
          <Body />
        </section>
      ))}
    </main>
  );
}
