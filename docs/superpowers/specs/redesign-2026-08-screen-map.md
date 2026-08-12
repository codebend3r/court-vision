repo: codebend3r/court-vision
branch: main

## Last sync

date: 2026-08-08T00:05:00Z

### Updated in this project

- Recreated all 12 current screens from source as `Court Vision — Current.dc.html`.
- Pulled the real token set (`src/styles/globals.scss`) and retro long-shadow mixins (`src/styles/mixins.scss`).
- Copied the wordmark assets from `public/` into the project.
- Built a redesign on top of the recreation, themed across 6 palettes and 4 text sizes.

## Screen map

| Screen                             | Repo files                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell (header / side nav / footer) | `src/app/layout.tsx`, `src/app/layout.module.scss`, `src/components/SiteHeader/*`, `src/components/SideNav/*`, `src/components/SiteFooter/*`, `src/components/AccountMenu/*`, `src/components/ThemeToggle/*`, `src/components/LeagueSwitcher/LeagueSwitcher.module.scss`                  |
| Home dashboard                     | `src/app/page.tsx`, `src/app/page.module.scss`, `src/components/HomeStarredPanel/*`, `src/components/HomeTeamPanel/*`, `src/components/HomeStandingsPanel/*`, `src/components/WatchlistTrendChart/*`                                                                                      |
| Players — Regular / Advanced       | `src/app/players/page.tsx`, `src/app/players/page.module.scss`, `src/components/PlayersTable/*`, `src/components/PlayersTabs/*`, `src/components/PlayersSearchControls/*`, `src/components/PlayersPager/*`, `src/components/AdvancedStatsLegend/*`, `src/lib/players/advancedStatMeta.ts` |
| Players — Fantasy Value            | `src/components/FantasyValueTable/*`, `src/components/FantasyControls/FantasyControls.module.scss`, `src/components/FantasyValueLegend/*`, `src/lib/valuation/registry.ts`                                                                                                                |
| Player detail                      | `src/app/players/[playerId]/page.tsx`, `src/app/players/[playerId]/page.module.scss`, `src/components/SeasonStatCard/*`, `src/components/PlayerStatFilters/*`, `src/components/PlayerGameLogTable/*`                                                                                      |
| Teams                              | `src/app/teams/page.tsx`, `src/app/teams/page.module.scss`, `src/components/TeamChip/TeamChip.tsx`                                                                                                                                                                                        |
| Team detail                        | `src/app/team/page.tsx`, `src/app/team/page.module.scss`, `src/lib/teams/stats.ts`                                                                                                                                                                                                        |
| My Teams                           | `src/app/my-teams/page.tsx`, `src/app/my-teams/page.module.scss`, `src/components/MyTeamsList/*`, `src/lib/fantasyTeams/slots.ts`                                                                                                                                                         |
| Leagues                            | `src/app/leagues/page.tsx`, `src/app/leagues/leagues.module.scss`, `src/components/LeagueList/LeagueList.module.scss`                                                                                                                                                                     |
| Starred / Watchlist                | `src/app/watchlist/page.tsx`, `src/components/StarButton/*`                                                                                                                                                                                                                               |
| Settings                           | `src/app/settings/page.tsx`, `src/components/SettingsFantasy/*`, `src/components/SettingsAppearance/*`, `src/components/SettingsTheme/*`, `src/lib/settings/types.ts`                                                                                                                     |
| Login                              | `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/LoginForm.tsx`, `src/app/(auth)/login/login.module.scss`, `src/app/(auth)/auth.module.scss`                                                                                                                                        |
| Shared primitives                  | `src/components/PlayerAvatar/*`, `src/components/PositionTag/*`, `src/components/Switch/Switch.module.scss`, `src/components/InfoTip/InfoTip.module.scss`                                                                                                                                 |
