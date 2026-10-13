// One line of a player's bio strip (height, college, draft…): the label and
// its formatted value, null when the record has nothing to show.
export type PlayerFact = { label: string; value: string | null };

export type PresentFact = { label: string; value: string };

// Keeps the facts worth printing: an absent or empty value drops its label
// too, so the strip never shows "College" over a blank.
export const isPresentFact = (fact: PlayerFact): fact is PresentFact => !!fact.value;
