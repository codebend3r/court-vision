"use client";

import { useLinkStatus } from "next/link";

import styles from "@/components/LinkPending/LinkPending.module.scss";

export type LinkPendingProps = {
  // Read to screen readers while the enclosing link's navigation is in flight.
  announcement: string;
};

// Rendered inside a next/link <Link>: `useLinkStatus` reports that link's
// in-flight navigation from the click until the new route renders. The spinner
// is the on-screen cue (a shape, so it doesn't lean on color), its
// `data-pending` feeds any page dim hung off `:has([data-pending="true"])`, and
// the status region tells screen-reader users the click registered. The region
// is mounted empty up front because a live region only announces changes.
export function LinkPending({ announcement }: LinkPendingProps) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending && <span className={styles.spinner} data-pending="true" aria-hidden="true" />}
      <span role="status" className={styles.announcement}>
        {pending && announcement}
      </span>
    </>
  );
}
