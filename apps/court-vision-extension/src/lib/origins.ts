import { COURT_VISION_DEV_ORIGIN, COURT_VISION_ORIGIN } from "@vision/yahoo-bridge/constants";

/**
 * The page origins whose messages the extension answers. A sender is compared
 * by exact string equality, so no prefix, suffix or subdomain gets through.
 */
export const allowedOrigins = ({ isDev }: { isDev: boolean }): readonly string[] =>
  isDev ? [COURT_VISION_ORIGIN, COURT_VISION_DEV_ORIGIN] : [COURT_VISION_ORIGIN];

/** The Court Vision page the toolbar icon opens. */
export const importPageUrl = ({ isDev }: { isDev: boolean }): string =>
  `${isDev ? COURT_VISION_DEV_ORIGIN : COURT_VISION_ORIGIN}/leagues/import`;
