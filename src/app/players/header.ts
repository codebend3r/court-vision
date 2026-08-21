import type { PageHeaderProps } from "@/components/PageHeader/PageHeader";

// The /players heading, shared by the page and its loading skeleton. The
// skeleton exists to make the swap jump-free, which only holds while the two
// render the same words; hard-coding them twice made that a matter of nobody
// editing one without the other.
//
// `satisfies` rather than an annotation: it still checks the shape against
// PageHeaderProps, but keeps `title` as a string instead of widening it to
// ReactNode, so tests can assert on it without a cast.
export const PLAYERS_PAGE_HEADER = {
  eyebrow: "Research",
  title: "Players",
  description:
    "Every player, every metric. Sort on the number your league scores, not the one the box score prints.",
} satisfies PageHeaderProps;
