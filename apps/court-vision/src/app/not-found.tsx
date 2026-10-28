import Link from "next/link";

import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";

import styles from "@/app/not-found.module.scss";

const SUGGESTIONS = [
  { href: "/players", label: "Players", hint: "Search and sort the whole league" },
  { href: "/teams", label: "Teams", hint: "Every NBA roster and its stats" },
  { href: "/my-teams", label: "Fantasy League", hint: "Your imported fantasy teams" },
  { href: "/leagues", label: "Leagues", hint: "Import or sync a Yahoo league" },
];

// The root not-found boundary: any unknown URL, and every `notFound()` call
// without a closer boundary, renders here inside the root layout, so the nav
// stays put and the visitor is one click from somewhere real. Static on
// purpose: no session read, so it renders the same signed in or out.
export default function NotFound() {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Error 404"
        title="Out of bounds"
        description="That page isn't on the court. The link may be old, or the address mistyped."
        actions={<PageAction href="/">Back to home</PageAction>}
      />
      <section className={styles.board} aria-labelledby="not-found-code">
        <div className={styles.readout}>
          <p className={styles.label}>Shot clock</p>
          <p id="not-found-code" className={styles.code}>
            <span className={styles.visuallyHidden}>Error </span>404
          </p>
          <p className={styles.note}>Possession: nobody. Page not found.</p>
        </div>
        <svg className={styles.court} viewBox="0 0 400 240" aria-hidden="true" focusable="false">
          <rect className={styles.line} x="8" y="8" width="300" height="224" rx="4" />
          <rect className={styles.paint} x="8" y="80" width="96" height="80" />
          <circle className={styles.line} cx="104" cy="120" r="30" />
          <path className={styles.line} d="M8 28 H40 A110 110 0 0 1 40 212 H8" />
          <circle className={styles.rim} cx="30" cy="120" r="7" />
          <line className={styles.line} x1="20" y1="104" x2="20" y2="136" />
          <path className={styles.flight} d="M150 170 Q 300 10 362 150" />
          <g className={styles.ball}>
            <circle cx="362" cy="170" r="20" />
            <path d="M342 170 H382 M362 150 V190 M348 156 Q362 170 348 184 M376 156 Q362 170 376 184" />
          </g>
        </svg>
      </section>
      <nav className={styles.suggestions} aria-labelledby="not-found-suggestions">
        <h2 id="not-found-suggestions" className={styles.heading}>
          Get back in the game
        </h2>
        <ul className={styles.list}>
          {SUGGESTIONS.map(({ href, label, hint }) => (
            <li key={href} className={styles.item}>
              <Link href={href} className={styles.link}>
                <span className={styles.linkLabel}>{label}</span>
                <span className={styles.linkHint}>{hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
