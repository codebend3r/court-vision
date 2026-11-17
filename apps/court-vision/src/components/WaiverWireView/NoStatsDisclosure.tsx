import { WaiverPlayer } from "@/components/WaiverWireView/WaiverPlayer";
import { type WaiverRosterEntry } from "@/lib/waiverWire/types";
import { Disclosure } from "@vision/ui/components/Disclosure/Disclosure";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

// My rostered players with no line in the range: listed, never valued, so
// they are not silently missing from "your weakest" or the cut line.
type NoStatsDisclosureProps = {
  entries: WaiverRosterEntry[];
  compareHintId: string;
};

export function NoStatsDisclosure({ entries, compareHintId }: NoStatsDisclosureProps) {
  return (
    <Disclosure
      className={styles.noStats}
      summaryClassName={styles.noStatsSummary}
      summary={<span>No stats in this range</span>}
    >
      <ul className={styles.noStatsList}>
        {entries.map((entry) => (
          <li key={entry.playerId}>
            <WaiverPlayer
              player={{
                playerId: entry.playerId,
                fullName: entry.fullName,
                teamAbbr: null,
                position: null,
                owner: "mine",
                injuryStatus: entry.injuryStatus,
              }}
              compareHintId={compareHintId}
            />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
