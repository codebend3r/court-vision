// How the runner is pointed at a server and told what to skip. The values
// arrive as plain arguments rather than being read here: `process.env` reads
// inside `src/` trip the security scan's secret-module rule, so the runner
// (outside `src/`) does the reading and this module does the deciding.

const DEFAULT_BASE_URL = "http://localhost:46644";

export type CheckOptions = {
  baseUrl: string;
  // One flag for both reasons a database-backed route gets skipped: an explicit
  // --skip-db, or no DATABASE_URL to reach. The caller does not need to care
  // which, so the distinction is resolved once, here.
  skipDbRoutes: boolean;
};

type Flags = {
  baseUrl: string | null;
  skipDb: boolean;
};

const BASE_URL_FLAG = "--base-url=";

const parseFlags = (argv: readonly string[]): Flags =>
  argv.reduce<Flags>(
    (flags, arg) => {
      if (arg === "--skip-db") return { ...flags, skipDb: true };
      if (arg.startsWith(BASE_URL_FLAG)) {
        return { ...flags, baseUrl: arg.slice(BASE_URL_FLAG.length) };
      }
      return flags;
    },
    { baseUrl: null, skipDb: false },
  );

export const parseCheckOptions = ({
  argv,
  perfBaseUrl,
  databaseUrl,
}: {
  argv: readonly string[];
  perfBaseUrl?: string;
  databaseUrl?: string;
}): CheckOptions => {
  const flags = parseFlags(argv);
  return {
    baseUrl: flags.baseUrl ?? perfBaseUrl ?? DEFAULT_BASE_URL,
    skipDbRoutes: flags.skipDb || databaseUrl === undefined || databaseUrl === "",
  };
};
