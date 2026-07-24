// Design-system entry barrel for the design-sync Vite build.
// Compiled into a browser ESM dist (react externalized, SCSS resolved) that the
// package-shape converter bundles into _ds_bundle.js. SiteHeader is omitted: it
// is an async server component that reads the auth session and cannot render
// client-side.
import "./fonts.scss";
import "@/styles/globals.scss";

// Preview-only wrappers (excluded from the component list via cfg.componentSrcMap).
export { PreviewProvider } from "./provider";
export { ThemeProvider } from "@/lib/theme/ThemeProvider";

export { AccountMenu } from "@/components/AccountMenu/AccountMenu";
export { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
export { ChartPaletteSwatches } from "@/components/ChartPaletteSwatches/ChartPaletteSwatches";
export { ComingSoonPanel } from "@/components/ComingSoonPanel/ComingSoonPanel";
export { FantasyControls } from "@/components/FantasyControls/FantasyControls";
export { FantasyPager } from "@/components/FantasyPager/FantasyPager";
export { FantasyValueLegend } from "@/components/FantasyValueLegend/FantasyValueLegend";
export { FantasyValueTable } from "@/components/FantasyValueTable/FantasyValueTable";
export { FantasyValueView } from "@/components/FantasyValueView/FantasyValueView";
export { InfoTip } from "@/components/InfoTip/InfoTip";
export { MyTeamsList } from "@/components/MyTeamsList/MyTeamsList";
export { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
export { PlayerGameLogTable } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
export { PlayerInsightPanel } from "@/components/PlayerInsightPanel/PlayerInsightPanel";
export { PlayersPager } from "@/components/PlayersPager/PlayersPager";
export { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
export { PlayersTabs } from "@/components/PlayersTabs/PlayersTabs";
export { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
export { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
export { PositionTag } from "@/components/PositionTag/PositionTag";
export { SeasonSelect } from "@/components/SeasonSelect/SeasonSelect";
export { SeasonStatCard } from "@/components/SeasonStatCard/SeasonStatCard";
export { SideNav } from "@/components/SideNav/SideNav";
export { SiteFooter } from "@/components/SiteFooter/SiteFooter";
export { Switch } from "@/components/Switch/Switch";
export { TeamBuilder } from "@/components/TeamBuilder/TeamBuilder";
export { TeamChip } from "@/components/TeamChip/TeamChip";
export { TeamEditor } from "@/components/TeamEditor/TeamEditor";
export { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";
export { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
export { TokenSwatch } from "@/components/TokenSwatch/TokenSwatch";
