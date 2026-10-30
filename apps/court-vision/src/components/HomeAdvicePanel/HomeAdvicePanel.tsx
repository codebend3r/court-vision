import Link from "next/link";

import { DashboardPanel, DashboardPanelEmpty } from "@/components/DashboardPanel/DashboardPanel";
import { formatScore } from "@vision/core/util/format";
import { ownerText } from "@/lib/advisor/format";
import { type AdvisorPlayer } from "@/lib/advisor/types";
import { type HomeAdvice } from "@/lib/home/insights";

import styles from "@/components/HomeAdvicePanel/HomeAdvicePanel.module.scss";

// Why there is no advice, and where to fix it: the Roster Advisor page owns
// the full explanation (import, pick a team, points leagues).
const NO_ADVICE = "Import your Yahoo league and pick your team to see who fixes your roster.";

type AdviceListProps = {
  players: readonly AdvisorPlayer[];
  methodLabel: string;
  emptyText: string;
};

// Name over team and owner, then season value. Best fit first.
function AdviceList({ players, methodLabel, emptyText }: AdviceListProps) {
  if (!players.length) return <DashboardPanelEmpty>{emptyText}</DashboardPanelEmpty>;
  return (
    <ol className={styles.list}>
      {players.map((player) => (
        <li key={player.playerId} className={styles.item}>
          <span className={styles.who}>
            <Link href={`/players/${player.playerId}`} className={styles.name}>
              {player.fullName}
            </Link>
            <span className={styles.meta}>
              {[player.teamAbbr, player.position, ownerText({ owner: player.owner })]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <span className={styles.value}>
            <span className={styles.srOnly}>{methodLabel} </span>
            {formatScore({ value: player.value })}
          </span>
        </li>
      ))}
    </ol>
  );
}

type AdviceFooterProps = { focusLabel: string; href: string; linkText: string };

function AdviceFooter({ focusLabel, href, linkText }: AdviceFooterProps) {
  return (
    <p className={styles.footer}>
      For your weakest: {focusLabel}. <Link href={href}>{linkText}</Link>
    </p>
  );
}

// The dashboard's two advisor panels differ only in what they read and where
// they point, so one component draws both from this table.
export type HomeAdviceKind = "trades" | "free_agents";

type PanelCopy = {
  id: string;
  title: string;
  emptyText: string;
  href: string;
  linkText: string;
  players: (advice: HomeAdvice) => readonly AdvisorPlayer[];
};

const PANELS: Record<HomeAdviceKind, PanelCopy> = {
  // The Roster Advisor's best fits on other teams, for the weak categories.
  trades: {
    id: "home-trade-targets-title",
    title: "Top Trade Targets",
    emptyText: "No player on another team is valued yet.",
    href: "/advisor",
    linkText: "See trades",
    players: (advice) => advice.tradeTargets,
  },
  // The best free agents and waiver claims for the weak categories.
  free_agents: {
    id: "home-free-agents-title",
    title: "Top Free Agents",
    emptyText: "No free agent is valued yet.",
    href: "/advisor?tab=free_agents",
    linkText: "See pickups",
    players: (advice) => advice.freeAgents,
  },
};

export type HomeAdvicePanelProps = {
  kind: HomeAdviceKind;
  advice: HomeAdvice | null;
  methodLabel: string;
  // Lets the page's grid place the panel; the panel itself stays
  // container-agnostic.
  className?: string;
};

export function HomeAdvicePanel({ kind, advice, methodLabel, className }: HomeAdvicePanelProps) {
  const panel = PANELS[kind];
  return (
    <DashboardPanel id={panel.id} title={panel.title} className={className}>
      {advice === null ? (
        <DashboardPanelEmpty>{NO_ADVICE}</DashboardPanelEmpty>
      ) : (
        <>
          <AdviceList
            players={panel.players(advice)}
            methodLabel={methodLabel}
            emptyText={panel.emptyText}
          />
          <AdviceFooter
            focusLabel={advice.focusLabel}
            href={panel.href}
            linkText={panel.linkText}
          />
        </>
      )}
    </DashboardPanel>
  );
}
