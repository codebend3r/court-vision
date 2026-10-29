"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "@/components/SideNav/SideNav.module.scss";

// Nav icons (spec §9): one 48-grid path each, stroke 4 for the 20px keycap slot.
const NAV_ICON_PATHS = {
  home: "M7 21 L24 8 L41 21 V41 H7 Z",
  players: "M24 9 a7 7 0 1 1 0 14 a7 7 0 1 1 0-14 M11 41 v-3 a13 13 0 0 1 26 0 v3",
  teams: "M17 8 L24 12 L31 8 L41 14 L36 23 L32 21 V41 H16 V21 L12 23 L7 14 Z",
  myTeams:
    "M9 12 a3 3 0 0 1 3-3 h24 a3 3 0 0 1 3 3 v27 a3 3 0 0 1-3 3 H12 a3 3 0 0 1-3-3 Z M17 22 h14 M17 31 h9",
  // Four bars of different heights: the roster's stats side by side.
  roster: "M9 40 V26 M19 40 V10 M29 40 V18 M39 40 V30",
  // Two opposed arrows: a free agent in, one of yours out.
  // Two bars facing each other over a divide: this week's head-to-head.
  matchup: "M9 14 H28 M9 24 H36 M9 34 H22 M39 12 V36",
  waiverWire: "M8 16 H38 M30 8 L38 16 L30 24 M40 32 H10 M18 24 L10 32 L18 40",
  // A crosshair: the weak spot, and the player who covers it.
  advisor: "M24 8 a16 16 0 1 1 0 32 a16 16 0 1 1 0-32 M24 4 V14 M24 34 V44 M4 24 H14 M34 24 H44",
  leagues: "M15 7 h18 v11 a9 9 0 0 1-18 0 Z M24 27 v7 M17 41 h14",
  starred: "M24 6 L29.5 18 L42 19.5 L33 28 L35.5 41 L24 34.5 L12.5 41 L15 28 L6 19.5 L18.5 18 Z",
  settings:
    "M9 14 h30 M9 24 h30 M9 34 h30 M19 10 a4 4 0 1 1 0 8 a4 4 0 1 1 0-8 M30 20 a4 4 0 1 1 0 8 a4 4 0 1 1 0-8 M16 30 a4 4 0 1 1 0 8 a4 4 0 1 1 0-8",
} as const;

type NavIconName = keyof typeof NAV_ICON_PATHS;

type NavEntry = {
  href: string;
  label: string;
  icon: NavIconName;
  // Other routes that belong to this section (Teams owns the /team detail).
  aliases?: readonly string[];
};

type NavGroup = {
  title: string;
  entries: NavEntry[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Research",
    entries: [
      { href: "/", label: "Home", icon: "home" },
      { href: "/players", label: "Players", icon: "players" },
      { href: "/teams", label: "Teams", icon: "teams", aliases: ["/team"] },
    ],
  },
  {
    title: "My league",
    entries: [
      { href: "/my-teams", label: "Fantasy League", icon: "myTeams" },
      { href: "/roster", label: "Roster", icon: "roster" },
      { href: "/matchup", label: "Matchup", icon: "matchup" },
      { href: "/waiver-wire", label: "Waiver Wire", icon: "waiverWire" },
      { href: "/advisor", label: "Roster Advisor", icon: "advisor" },
      { href: "/leagues", label: "Leagues", icon: "leagues" },
      { href: "/watchlist", label: "Starred", icon: "starred" },
    ],
  },
];

const SETTINGS_ENTRY: NavEntry = { href: "/settings", label: "Settings", icon: "settings" };

type NavIconProps = { name: NavIconName };

function NavIcon({ name }: NavIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={NAV_ICON_PATHS[name]} />
    </svg>
  );
}

// A section owns its own route and every route nested under it, so
// /players/1234 keeps Players lit. Home ("/") only ever matches itself.
type IsWithinProps = { pathname: string; href: string };

const isWithin = ({ pathname, href }: IsWithinProps): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);

type IsEntryActiveProps = { entry: NavEntry; pathname: string };

const isEntryActive = ({ entry, pathname }: IsEntryActiveProps): boolean =>
  [entry.href, ...(entry.aliases ?? [])].some((href) => isWithin({ pathname, href }));

type NavItemProps = { entry: NavEntry; pathname: string };

function NavItem({ entry, pathname }: NavItemProps) {
  const active = isEntryActive({ entry, pathname });
  return (
    <li className={styles.item}>
      <Link
        href={entry.href}
        className={styles.link}
        aria-current={active ? "page" : undefined}
        data-active={active ? "true" : undefined}
      >
        <span className={styles.cap}>
          <NavIcon name={entry.icon} />
        </span>
        <span className={styles.label}>{entry.label}</span>
      </Link>
    </li>
  );
}

// The rail: collapsed 60px, expands on hover or keyboard focus. It overlays
// the content (absolute inside the layout's 60px slot) so expansion never
// reflows the page.
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Site">
      <div className={styles.groups}>
        {NAV_GROUPS.map((group) => (
          <section key={group.title} className={styles.group} aria-label={group.title}>
            <p className={styles.groupTitle} aria-hidden="true">
              <span className={styles.cap} />
              <span className={styles.label}>{group.title}</span>
            </p>
            <ul className={styles.list}>
              {group.entries.map((entry) => (
                <NavItem key={entry.href} entry={entry} pathname={pathname} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ul className={styles.list}>
        <NavItem entry={SETTINGS_ENTRY} pathname={pathname} />
      </ul>
    </nav>
  );
}
