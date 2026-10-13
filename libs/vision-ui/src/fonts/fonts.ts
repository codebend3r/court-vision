import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// The design system's three faces, declared once (Next's font definitions file
// pattern) so every *-vision app hosts the same instances. Each exposes the CSS
// variable the shared globals' --font-* tokens read (--font-display-next and
// friends); put FONT_VARIABLES on <html>.
const displayFont = Chakra_Petch({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-next",
});

const bodyFont = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body-next",
});

const monoFont = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-next",
});

export const FONT_VARIABLES = `${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`;
