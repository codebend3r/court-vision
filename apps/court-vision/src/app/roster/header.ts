import type { PageHeaderProps } from "@vision/ui/components/PageHeader/PageHeader";

// The /roster heading, shared by the page and its loading skeleton so the two
// render the same words and the swap doesn't jump. `satisfies` keeps `title` a
// string for tests while still checking the shape.
export const ROSTER_PAGE_HEADER = {
  eyebrow: "My league",
  title: "Roster",
  description:
    "Every player on your team, stat by stat, with charts that show who is carrying it and who is not.",
} satisfies PageHeaderProps;
