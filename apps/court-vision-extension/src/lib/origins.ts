import { COURT_VISION_DEV_ORIGIN, COURT_VISION_ORIGIN } from "@vision/yahoo-bridge/constants";

/**
 * The page origins whose messages the extension answers. A sender is compared
 * by exact string equality, so no prefix, suffix or subdomain gets through.
 */
type AllowedOriginsProps = { isDev: boolean };

export const allowedOrigins = ({ isDev }: AllowedOriginsProps): readonly string[] =>
  isDev ? [COURT_VISION_ORIGIN, COURT_VISION_DEV_ORIGIN] : [COURT_VISION_ORIGIN];

/** The Court Vision page the toolbar icon opens. */
type ImportPageUrlProps = { isDev: boolean };

export const importPageUrl = ({ isDev }: ImportPageUrlProps): string =>
  `${isDev ? COURT_VISION_DEV_ORIGIN : COURT_VISION_ORIGIN}/leagues/import`;
