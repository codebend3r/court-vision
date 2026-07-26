// Preview provider wired into cfg.provider so components that read the theme
// context or nuqs query-state render inside the design-sync preview cards.
// Mirrors the app's root layout providers (NuqsAdapter + ThemeProvider),
// swapping the Next router adapter for nuqs's router-free testing adapter.
import { type CSSProperties, type ReactNode } from "react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

// Court Vision is a dark-first design system: the app body is painted with
// --color-bg and text with --color-text. Preview cards render on a white
// canvas, so mirror the app surface here — otherwise light-on-dark components
// (labels, tooltips) render nearly invisible on white.
const surface: CSSProperties = {
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--font-size-md)",
  lineHeight: 1.5,
  padding: "20px",
  borderRadius: "8px",
};

export function PreviewProvider({ children }: { children: ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <ThemeProvider>
        <div style={surface}>{children}</div>
      </ThemeProvider>
    </NuqsTestingAdapter>
  );
}
