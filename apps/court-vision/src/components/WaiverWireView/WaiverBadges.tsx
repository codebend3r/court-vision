import { type WaiverOwner } from "@/lib/waiverWire/types";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

// Yahoo's injury codes, read out in full. An unknown code reads as itself.
const INJURY_NAMES = new Map([
  ["Q", "Questionable"],
  ["O", "Out"],
  ["P", "Probable"],
  ["D", "Doubtful"],
  ["INJ", "Injured"],
  ["NA", "Not active"],
]);

// The codes that keep a player off the floor take the loss tone.
const SIDELINED = new Set(["O", "INJ", "NA"]);

type BadgeTone = "injury" | "sidelined" | "waivers";

type Badge = { kind: "injury" | "waivers"; code: string; name: string; tone: BadgeTone };

const WAIVERS_BADGE: Badge = { kind: "waivers", code: "W", name: "On waivers", tone: "waivers" };

const injuryBadges = ({ injuryStatus }: { injuryStatus: string | null }): Badge[] =>
  injuryStatus
    ? [
        {
          kind: "injury",
          code: injuryStatus,
          name: INJURY_NAMES.get(injuryStatus) ?? injuryStatus,
          tone: SIDELINED.has(injuryStatus) ? "sidelined" : "injury",
        },
      ]
    : [];

export type WaiverBadgesProps = {
  injuryStatus: string | null;
  owner: WaiverOwner;
};

// A player's status as short text badges: the injury code, and `W` while on
// waivers. The code is what sighted readers scan; the full name is what a
// screen reader hears, so the tone colour is never the only cue.
export function WaiverBadges({ injuryStatus, owner }: WaiverBadgesProps) {
  const badges = [
    ...injuryBadges({ injuryStatus }),
    ...(owner === "waivers" ? [WAIVERS_BADGE] : []),
  ];

  if (badges.length === 0) return null;

  return (
    <span className={styles.badges}>
      {badges.map((badge) => (
        <span key={badge.kind} className={styles.badge} data-tone={badge.tone}>
          <span aria-hidden="true">{badge.code}</span>
          <span className={styles.srOnly}>{badge.name}</span>
        </span>
      ))}
    </span>
  );
}
