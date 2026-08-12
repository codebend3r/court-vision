"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "@/components/SideNav/SideNav.module.scss";

// Nav icons (spec §9): one 48-grid path each, stroke 4 for the 20px keycap slot.
const NAV_ICON_PATHS = {
  home: "M7 21 L24 8 L41 21 V41 H7 Z",
  players: "M19 9 a7 7 0 1 1 0 14 a7 7 0 1 1 0-14 M6 41 v-3 a13 13 0 0 1 26 0 v3",
  teams: "M17 8 L24 12 L31 8 L41 14 L36 23 L32 21 V41 H16 V21 L12 23 L7 14 Z",
  myTeams:
    "M9 12 a3 3 0 0 1 3-3 h24 a3 3 0 0 1 3 3 v27 a3 3 0 0 1-3 3 H12 a3 3 0 0 1-3-3 Z M17 22 h14 M17 31 h9",
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
      { href: "/teams", label: "Teams", icon: "teams" },
    ],
  },
  {
    title: "My league",
    entries: [
      { href: "/my-teams", label: "My Teams", icon: "myTeams" },
      { href: "/leagues", label: "Leagues", icon: "leagues" },
      { href: "/watchlist", label: "Starred", icon: "starred" },
    ],
  },
];

const SETTINGS_ENTRY: NavEntry = { href: "/settings", label: "Settings", icon: "settings" };

function NavIcon({ name }: { name: NavIconName }) {
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

const isEntryActive = ({ entry, pathname }: { entry: NavEntry; pathname: string }): boolean =>
  pathname === entry.href ||
  // /team (the detail page) belongs to Teams; nested routes to their section.
  (entry.href === "/teams" && pathname === "/team") ||
  (entry.href === "/my-teams" && pathname.startsWith("/my-teams/")) ||
  (entry.href === "/leagues" && pathname.startsWith("/leagues/")) ||
  (entry.href === "/players" && pathname.startsWith("/players/"));

function NavItem({ entry, pathname }: { entry: NavEntry; pathname: string }) {
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
