// WCAG color math for team colors: which ink reads on a chip, and whether a
// team's line would vanish against the page.

const channelLuminance = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

// WCAG relative luminance of a #rrggbb hex: 0 for black, 1 for white.
export const relativeLuminance = ({ hex }: { hex: string }): number => {
  const [red, green, blue] = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(channelLuminance);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

// WCAG contrast ratio between two #rrggbb colors, 1 (identical) to 21.
export const contrastRatio = ({ a, b }: { a: string; b: string }): number => {
  const [lighter, darker] = [relativeLuminance({ hex: a }), relativeLuminance({ hex: b })].sort(
    (left, right) => right - left,
  );
  return (lighter + 0.05) / (darker + 0.05);
};

// Black or white text, whichever the background clears 4.5:1 against black
// with: black on light fills, white on dark ones.
export const contrastTextFor = ({ background }: { background: string }): "#000000" | "#FFFFFF" =>
  contrastRatio({ a: background, b: "#000000" }) >= 4.5 ? "#000000" : "#FFFFFF";
